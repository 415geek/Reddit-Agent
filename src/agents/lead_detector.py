from loguru import logger

from ..database.db import get_db
from ..database.models import RedditPost, PostAnalysis, Lead


LEAD_TYPES = {
    "restaurant_owner": "Existing restaurant owner",
    "planning_owner": "Planning to open restaurant",
    "evaluating_pos": "Actively evaluating POS systems",
    "seeking_alternative": "Seeking competitor alternative",
    "bubble_tea_owner": "Bubble tea / specialty shop owner",
    "food_truck_owner": "Food truck operator",
    "multi_location": "Multi-location restaurant operator",
}


class LeadDetector:
    def __init__(self, config: dict):
        self.config = config
        self.min_lead_score = config["scoring"]["min_lead_score_for_alert"]

    def _determine_lead_type(self, post: RedditPost, analysis: PostAnalysis) -> str:
        title_body = f"{post.title} {post.body}".lower()

        if analysis.is_evaluating_pos and analysis.competitor_mentions:
            return "seeking_alternative"
        if analysis.is_evaluating_pos:
            return "evaluating_pos"
        if analysis.is_new_restaurant:
            return "planning_owner"
        if "bubble tea" in title_body or "boba" in title_body:
            return "bubble_tea_owner"
        if "food truck" in title_body:
            return "food_truck_owner"
        if any(w in title_body for w in ["multiple location", "multi-location", "chain"]):
            return "multi_location"
        if analysis.is_restaurant_owner:
            return "restaurant_owner"
        return "restaurant_owner"

    def detect_lead(self, post: RedditPost, analysis: PostAnalysis) -> Lead | None:
        if analysis.lead_score < self.min_lead_score:
            return None

        if not (analysis.is_restaurant_owner or analysis.is_evaluating_pos or analysis.is_new_restaurant):
            return None

        lead_type = self._determine_lead_type(post, analysis)
        notes = (
            f"Category: {analysis.category}\n"
            f"Summary: {analysis.summary}\n"
            f"Competitors mentioned: {', '.join(analysis.competitor_mentions) if analysis.competitor_mentions else 'None'}\n"
            f"Sentiment: {analysis.sentiment}"
        )

        lead = Lead(
            post_id=post.id,
            reddit_username=post.author,
            subreddit=post.subreddit,
            lead_score=analysis.lead_score,
            lead_type=lead_type,
            notes=notes,
        )
        logger.info(f"Lead detected: {post.author} [{lead_type}] score={analysis.lead_score:.1f}")
        return lead

    def process_new_leads(self) -> list[Lead]:
        leads = []
        with get_db() as session:
            pairs = (
                session.query(RedditPost, PostAnalysis)
                .join(PostAnalysis)
                .filter(RedditPost.is_processed == True)
                .outerjoin(Lead, Lead.post_id == RedditPost.id)
                .filter(Lead.id == None)
                .filter(PostAnalysis.lead_score >= self.min_lead_score)
                .all()
            )

            for post, analysis in pairs:
                lead = self.detect_lead(post, analysis)
                if lead:
                    session.add(lead)
                    leads.append(lead)

        logger.info(f"Detected {len(leads)} new leads")
        return leads
