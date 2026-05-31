import os
import asyncio
from datetime import datetime
from loguru import logger
from telegram import Bot
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters
from telegram.error import TelegramError

from ..database.db import get_db
from ..database.models import (
    RedditPost, PostAnalysis, GeneratedReply, Lead, ApprovalStatus
)
from .keyboards import reply_approval_keyboard, lead_action_keyboard
from .handlers import (
    cmd_start, cmd_summary, cmd_top, cmd_leads, cmd_competitors,
    cmd_stats, cmd_posts, handle_callback, handle_edit_message
)


def truncate(text: str, max_len: int = 200) -> str:
    return text[:max_len] + "..." if len(text) > max_len else text


def format_score_bar(score: float, max_score: float = 10.0) -> str:
    filled = int((score / max_score) * 10)
    bar = "█" * filled + "░" * (10 - filled)
    return f"{bar} {score:.1f}/10"


class TelegramBot:
    def __init__(self, config: dict):
        self.config = config
        self.token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.chat_id = os.getenv("TELEGRAM_CHAT_ID")
        self.app = None
        self.bot = None
        self._notified_ids = set()

    def setup(self):
        if not self.token:
            logger.warning("TELEGRAM_BOT_TOKEN not set — Telegram bot disabled")
            return

        self.app = Application.builder().token(self.token).build()
        self.bot = self.app.bot

        self.app.add_handler(CommandHandler("start", cmd_start))
        self.app.add_handler(CommandHandler("help", cmd_start))
        self.app.add_handler(CommandHandler("summary", cmd_summary))
        self.app.add_handler(CommandHandler("top", cmd_top))
        self.app.add_handler(CommandHandler("leads", cmd_leads))
        self.app.add_handler(CommandHandler("competitors", cmd_competitors))
        self.app.add_handler(CommandHandler("stats", cmd_stats))
        self.app.add_handler(CommandHandler("posts", cmd_posts))
        self.app.add_handler(CallbackQueryHandler(handle_callback))
        self.app.add_handler(
            MessageHandler(filters.TEXT & ~filters.COMMAND, handle_edit_message)
        )

        logger.info("Telegram bot configured")

    async def send_opportunity_alert(self, post: RedditPost, analysis: PostAnalysis, replies: list[GeneratedReply]):
        if not self.bot or not self.chat_id:
            return

        if post.id in self._notified_ids:
            return

        try:
            header_msg = (
                f"🎯 *New Opportunity Found!*\n\n"
                f"*Subreddit:* r/{post.subreddit}\n"
                f"*Title:* {truncate(post.title, 120)}\n\n"
                f"*Opportunity Score:* {format_score_bar(analysis.opportunity_score)}\n"
                f"*Lead Score:* {format_score_bar(analysis.lead_score)}\n\n"
                f"*Category:* {analysis.category}\n"
                f"*Competitors:* {', '.join(analysis.competitor_mentions) if analysis.competitor_mentions else 'None'}\n\n"
                f"*Summary:*\n{truncate(analysis.summary, 400)}\n\n"
                f"[View Post]({post.url})"
            )
            await self.bot.send_message(
                chat_id=self.chat_id,
                text=header_msg,
                parse_mode="Markdown",
                disable_web_page_preview=True,
            )

            for reply in replies[:3]:
                style_emoji = {"professional": "👔", "friendly": "😊", "educational": "📚"}.get(reply.style, "💬")
                reply_msg = (
                    f"{style_emoji} *{reply.style.title()} Reply Option*\n\n"
                    f"{truncate(reply.content, 800)}"
                )
                await self.bot.send_message(
                    chat_id=self.chat_id,
                    text=reply_msg,
                    parse_mode="Markdown",
                    reply_markup=reply_approval_keyboard(reply.id),
                )

            self._notified_ids.add(post.id)
            logger.info(f"Sent opportunity alert for post {post.reddit_id}")

        except TelegramError as e:
            logger.error(f"Telegram send error: {e}")

    async def send_lead_alert(self, lead: Lead, post: RedditPost):
        if not self.bot or not self.chat_id:
            return

        try:
            msg = (
                f"👤 *New Lead Detected!*\n\n"
                f"*User:* u/{lead.reddit_username}\n"
                f"*Subreddit:* r/{lead.subreddit}\n"
                f"*Type:* {lead.lead_type.replace('_', ' ').title()}\n"
                f"*Lead Score:* {format_score_bar(lead.lead_score)}\n\n"
                f"*Context:*\n{truncate(post.title, 120)}\n\n"
                f"[View Post]({post.url})"
            )
            await self.bot.send_message(
                chat_id=self.chat_id,
                text=msg,
                parse_mode="Markdown",
                disable_web_page_preview=True,
                reply_markup=lead_action_keyboard(lead.id),
            )
        except TelegramError as e:
            logger.error(f"Telegram lead alert error: {e}")

    async def send_message(self, text: str, parse_mode: str = "Markdown"):
        if not self.bot or not self.chat_id:
            return
        try:
            await self.bot.send_message(
                chat_id=self.chat_id,
                text=text,
                parse_mode=parse_mode,
            )
        except TelegramError as e:
            logger.error(f"Telegram message error: {e}")

    async def process_new_alerts(self):
        if not self.bot:
            return

        with get_db() as session:
            results = (
                session.query(RedditPost, PostAnalysis)
                .join(PostAnalysis)
                .filter(PostAnalysis.opportunity_score >= self.config["scoring"]["min_score_for_alert"])
                .filter(~RedditPost.id.in_(self._notified_ids))
                .order_by(PostAnalysis.opportunity_score.desc())
                .limit(3)
                .all()
            )

            for post, analysis in results:
                replies = (
                    session.query(GeneratedReply)
                    .filter_by(post_id=post.id)
                    .all()
                )
                session.expunge_all()
                await self.send_opportunity_alert(post, analysis, replies)

    def run_polling(self):
        if not self.app:
            logger.warning("Telegram app not initialized")
            return
        logger.info("Starting Telegram bot polling...")
        self.app.run_polling(allowed_updates=["message", "callback_query"])
