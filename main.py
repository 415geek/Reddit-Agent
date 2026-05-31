#!/usr/bin/env python3
"""
Restaurant Competitive Intelligence Agent
Main orchestrator — runs all agents on schedule.
"""

import asyncio
import os
import sys
from pathlib import Path
from datetime import datetime

from dotenv import load_dotenv
load_dotenv()

import yaml
from loguru import logger
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

from src.utils.logger import setup_logger
from src.database.db import init_db
from src.agents.reddit_monitor import RedditMonitor
from src.agents.ai_scorer import AIScorer
from src.agents.lead_detector import LeadDetector
from src.agents.reply_generator import ReplyGenerator
from src.agents.post_generator import PostGenerator
from src.telegram.bot import TelegramBot


def load_config() -> dict:
    config_path = Path("config/config.yaml")
    with open(config_path) as f:
        return yaml.safe_load(f)


class AgentOrchestrator:
    def __init__(self):
        self.config = load_config()
        self.scheduler = AsyncIOScheduler()
        self.monitor = RedditMonitor(self.config)
        self.scorer = AIScorer(self.config)
        self.lead_detector = LeadDetector(self.config)
        self.reply_gen = ReplyGenerator(self.config)
        self.post_gen = PostGenerator(self.config)
        self.telegram = TelegramBot(self.config)

    async def monitoring_cycle(self):
        logger.info("=== Starting monitoring cycle ===")
        try:
            result = self.monitor.run_cycle()
            logger.info(f"Collected: {result}")

            scored = self.scorer.process_unscored_posts(limit=20)
            logger.info(f"Scored {len(scored)} posts")

            leads = self.lead_detector.process_new_leads()
            logger.info(f"Detected {len(leads)} leads")

            replies = self.reply_gen.process_pending_posts(limit=3)
            logger.info(f"Generated {len(replies)} reply drafts")

            await self.telegram.process_new_alerts()

            for lead in leads:
                from src.database.db import get_db
                from src.database.models import RedditPost
                with get_db() as session:
                    post = session.query(RedditPost).get(lead.post_id)
                    if post:
                        session.expunge_all()
                        await self.telegram.send_lead_alert(lead, post)

        except Exception as e:
            logger.error(f"Monitoring cycle error: {e}", exc_info=True)

    async def weekly_post_generation(self):
        logger.info("=== Generating weekly content batch ===")
        try:
            posts = self.post_gen.generate_weekly_batch()
            logger.info(f"Generated {len(posts)} weekly posts")

            await self.telegram.send_message(
                f"📝 *Weekly Content Generated*\n\n"
                f"{len(posts)} posts created and awaiting approval.\n"
                f"Use /posts to review them."
            )
        except Exception as e:
            logger.error(f"Weekly generation error: {e}", exc_info=True)

    def setup_scheduler(self):
        interval = self.config["monitoring"]["interval_minutes"]
        self.scheduler.add_job(
            self.monitoring_cycle,
            trigger=IntervalTrigger(minutes=interval),
            id="monitoring_cycle",
            name="Reddit Monitoring Cycle",
            replace_existing=True,
        )
        logger.info(f"Monitoring scheduled every {interval} minutes")

        weekly = self.config["post_generation"]["weekly_schedule"]
        self.scheduler.add_job(
            self.weekly_post_generation,
            trigger=CronTrigger(
                day_of_week=weekly["day"][:3].lower(),
                hour=weekly["hour"],
                minute=0,
            ),
            id="weekly_posts",
            name="Weekly Post Generation",
            replace_existing=True,
        )
        logger.info(f"Weekly posts scheduled: {weekly['day']} at {weekly['hour']}:00")

    async def run(self):
        logger.info("Starting Restaurant Intelligence Agent...")

        init_db()
        logger.info("Database initialized")

        self.telegram.setup()

        self.setup_scheduler()
        self.scheduler.start()
        logger.info("Scheduler started")

        await self.monitoring_cycle()

        if self.telegram.app:
            await self.telegram.app.initialize()
            await self.telegram.app.start()
            logger.info("Telegram bot running")

            await self.telegram.send_message(
                "🤖 *Restaurant Intelligence Agent Started*\n\n"
                f"Monitoring {len(self.config['monitoring']['subreddits'])} subreddits\n"
                f"Checking every {self.config['monitoring']['interval_minutes']} minutes\n\n"
                "Type /help for available commands."
            )

            await self.telegram.app.updater.start_polling()

        logger.info("Agent running. Press Ctrl+C to stop.")
        try:
            while True:
                await asyncio.sleep(60)
        except (KeyboardInterrupt, SystemExit):
            logger.info("Shutting down...")
        finally:
            self.scheduler.shutdown()
            if self.telegram.app:
                await self.telegram.app.updater.stop()
                await self.telegram.app.stop()
                await self.telegram.app.shutdown()


def main():
    setup_logger()
    orchestrator = AgentOrchestrator()
    asyncio.run(orchestrator.run())


if __name__ == "__main__":
    main()
