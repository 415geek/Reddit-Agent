import os
import re
from datetime import datetime, timezone
from typing import Optional
import praw
from praw.models import Submission, Comment
from loguru import logger
from sqlalchemy.orm import Session

from ..database.db import get_db
from ..database.models import RedditPost, RedditComment


class RedditMonitor:
    def __init__(self, config: dict):
        self.config = config
        self.subreddits = config["monitoring"]["subreddits"]
        self.keywords = [kw.lower() for kw in config["monitoring"]["keywords"]]
        self.post_limit = config["monitoring"].get("post_limit", 25)
        self.comment_limit = config["monitoring"].get("comment_limit", 50)
        self.reddit = self._init_reddit()

    def _init_reddit(self) -> praw.Reddit:
        return praw.Reddit(
            client_id=os.getenv("REDDIT_CLIENT_ID"),
            client_secret=os.getenv("REDDIT_CLIENT_SECRET"),
            user_agent=os.getenv("REDDIT_USER_AGENT", "RestaurantIntelligenceAgent/1.0"),
            read_only=True,
        )

    def _find_matched_keywords(self, text: str) -> list[str]:
        text_lower = text.lower()
        return [kw for kw in self.keywords if kw in text_lower]

    def _convert_timestamp(self, utc_timestamp: float) -> datetime:
        return datetime.fromtimestamp(utc_timestamp, tz=timezone.utc).replace(tzinfo=None)

    def _post_exists(self, session: Session, reddit_id: str) -> bool:
        return session.query(RedditPost).filter_by(reddit_id=reddit_id).first() is not None

    def _comment_exists(self, session: Session, reddit_id: str) -> bool:
        return session.query(RedditComment).filter_by(reddit_id=reddit_id).first() is not None

    def fetch_new_posts(self) -> list[RedditPost]:
        collected = []
        for subreddit_name in self.subreddits:
            try:
                subreddit = self.reddit.subreddit(subreddit_name)
                posts = list(subreddit.new(limit=self.post_limit))
                logger.debug(f"Checking r/{subreddit_name}: {len(posts)} posts")

                for submission in posts:
                    full_text = f"{submission.title} {submission.selftext}"
                    matched = self._find_matched_keywords(full_text)
                    if not matched:
                        continue

                    with get_db() as session:
                        if self._post_exists(session, submission.id):
                            continue

                        post = RedditPost(
                            reddit_id=submission.id,
                            title=submission.title,
                            body=submission.selftext or "",
                            subreddit=subreddit_name,
                            author=str(submission.author) if submission.author else "[deleted]",
                            url=f"https://reddit.com{submission.permalink}",
                            score=submission.score,
                            comment_count=submission.num_comments,
                            created_utc=self._convert_timestamp(submission.created_utc),
                            matched_keywords=matched,
                        )
                        session.add(post)
                        collected.append(post)
                        logger.info(f"New post: [{subreddit_name}] {submission.title[:60]}...")

            except Exception as e:
                logger.error(f"Error fetching posts from r/{subreddit_name}: {e}")

        logger.info(f"Collected {len(collected)} new posts")
        return collected

    def fetch_new_comments(self) -> list[RedditComment]:
        collected = []
        for subreddit_name in self.subreddits:
            try:
                subreddit = self.reddit.subreddit(subreddit_name)
                comments = list(subreddit.comments(limit=self.comment_limit))
                logger.debug(f"Checking r/{subreddit_name}: {len(comments)} comments")

                for comment in comments:
                    matched = self._find_matched_keywords(comment.body)
                    if not matched:
                        continue

                    with get_db() as session:
                        if self._comment_exists(session, comment.id):
                            continue

                        rc = RedditComment(
                            reddit_id=comment.id,
                            post_reddit_id=comment.link_id.replace("t3_", ""),
                            body=comment.body,
                            subreddit=subreddit_name,
                            author=str(comment.author) if comment.author else "[deleted]",
                            score=comment.score,
                            created_utc=self._convert_timestamp(comment.created_utc),
                            matched_keywords=matched,
                        )
                        session.add(rc)
                        collected.append(rc)

            except Exception as e:
                logger.error(f"Error fetching comments from r/{subreddit_name}: {e}")

        logger.info(f"Collected {len(collected)} new comments")
        return collected

    def get_unprocessed_posts(self, limit: int = 10) -> list[RedditPost]:
        with get_db() as session:
            posts = (
                session.query(RedditPost)
                .filter_by(is_processed=False)
                .order_by(RedditPost.created_utc.desc())
                .limit(limit)
                .all()
            )
            session.expunge_all()
            return posts

    def run_cycle(self) -> dict:
        logger.info("Starting Reddit monitoring cycle")
        new_posts = self.fetch_new_posts()
        new_comments = self.fetch_new_comments()
        return {
            "new_posts": len(new_posts),
            "new_comments": len(new_comments),
        }
