import json
from datetime import datetime
from loguru import logger

from ..database.db import get_db
from ..database.models import RedditPost, PostAnalysis, CommentAnalysis, RedditComment
from ..utils.ollama_client import OllamaClient


SCORING_SYSTEM_PROMPT = """You are an expert restaurant industry analyst helping identify sales opportunities for a restaurant POS system called RestoSuite.

Analyze Reddit posts/comments about restaurants and POS systems. Score each piece of content on multiple dimensions.

Always respond with valid JSON only. No markdown, no explanation outside the JSON."""


SCORING_PROMPT_TEMPLATE = """Analyze this Reddit {content_type} and return a JSON scoring analysis.

Subreddit: r/{subreddit}
Author: {author}
{title_section}
Content: {body}

Matched keywords: {keywords}

Return this exact JSON structure:
{{
  "opportunity_score": <float 0-10>,
  "lead_score": <float 0-10>,
  "category": "<one of: Competitor Complaint, POS Shopping Intent, New Restaurant Opening, Technology Discussion, General Discussion>",
  "summary": "<2-3 sentence summary of the opportunity>",
  "competitor_mentions": ["<competitor names mentioned>"],
  "sentiment": "<positive, negative, or neutral>",
  "is_restaurant_owner": <true or false>,
  "is_evaluating_pos": <true or false>,
  "is_new_restaurant": <true or false>,
  "reasoning": "<brief explanation of scores>"
}}

Scoring guidelines:
- opportunity_score 8-10: Direct complaint about competitor OR actively shopping for POS
- opportunity_score 6-7: General POS discussion with purchase intent signals
- opportunity_score 4-5: Restaurant tech discussion, may be interested later
- opportunity_score 1-3: General discussion, low relevance
- lead_score 8-10: Clearly a restaurant owner/operator actively looking for solutions
- lead_score 5-7: Likely a restaurant owner or someone planning to open
- lead_score 1-4: Unclear ownership status"""


class AIScorer:
    def __init__(self, config: dict):
        self.config = config
        self.ollama = OllamaClient(
            host=config["ollama"]["host"],
            model=config["scoring"]["model"],
            timeout=config["ollama"]["timeout"],
        )
        self.min_score = config["scoring"]["min_score_for_alert"]
        self.min_lead_score = config["scoring"]["min_lead_score_for_alert"]

    def score_post(self, post: RedditPost) -> PostAnalysis | None:
        prompt = SCORING_PROMPT_TEMPLATE.format(
            content_type="post",
            subreddit=post.subreddit,
            author=post.author,
            title_section=f"Title: {post.title}",
            body=post.body[:2000] if post.body else "(no body)",
            keywords=", ".join(post.matched_keywords or []),
        )

        result = self.ollama.generate_json(
            prompt=prompt,
            system=SCORING_SYSTEM_PROMPT,
        )

        if not result:
            logger.warning(f"No scoring result for post {post.reddit_id}")
            return self._default_analysis(post)

        try:
            analysis = PostAnalysis(
                post_id=post.id,
                opportunity_score=float(result.get("opportunity_score", 0)),
                lead_score=float(result.get("lead_score", 0)),
                category=result.get("category", "General Discussion"),
                summary=result.get("summary", ""),
                competitor_mentions=result.get("competitor_mentions", []),
                sentiment=result.get("sentiment", "neutral"),
                is_restaurant_owner=bool(result.get("is_restaurant_owner", False)),
                is_evaluating_pos=bool(result.get("is_evaluating_pos", False)),
                is_new_restaurant=bool(result.get("is_new_restaurant", False)),
            )
            logger.info(
                f"Scored post {post.reddit_id}: opp={analysis.opportunity_score:.1f}, "
                f"lead={analysis.lead_score:.1f}, category={analysis.category}"
            )
            return analysis
        except Exception as e:
            logger.error(f"Error building PostAnalysis: {e}")
            return self._default_analysis(post)

    def _default_analysis(self, post: RedditPost) -> PostAnalysis:
        return PostAnalysis(
            post_id=post.id,
            opportunity_score=1.0,
            lead_score=1.0,
            category="General Discussion",
            summary="Automated scoring failed; manual review recommended.",
            competitor_mentions=[],
            sentiment="neutral",
        )

    def process_unscored_posts(self, limit: int = 20) -> list[PostAnalysis]:
        results = []
        with get_db() as session:
            posts = (
                session.query(RedditPost)
                .filter_by(is_processed=False)
                .order_by(RedditPost.created_utc.desc())
                .limit(limit)
                .all()
            )

            for post in posts:
                analysis = self.score_post(post)
                if analysis:
                    session.add(analysis)
                    post.is_processed = True
                    results.append(analysis)

        logger.info(f"Scored {len(results)} posts")
        return results

    def get_high_priority_posts(self, session, limit: int = 10) -> list:
        return (
            session.query(RedditPost, PostAnalysis)
            .join(PostAnalysis)
            .filter(PostAnalysis.opportunity_score >= self.min_score)
            .order_by(PostAnalysis.opportunity_score.desc())
            .limit(limit)
            .all()
        )
