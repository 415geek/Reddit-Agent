from loguru import logger

from ..database.db import get_db
from ..database.models import RedditPost, PostAnalysis, GeneratedReply
from ..utils.ollama_client import OllamaClient


REPLY_SYSTEM_PROMPT = """You are an experienced restaurant operator with 15+ years running successful restaurants.
You participate in Reddit communities to share genuine advice and help other restaurant owners.

Rules:
- Never directly promote any specific POS product unless the conversation naturally leads there
- Sound like a real restaurant owner sharing experience, not a sales representative
- Be helpful, empathetic, and practical
- Share specific, actionable advice
- Only mention RestoSuite if the thread is specifically asking for POS alternatives
- Keep replies under 500 words
- Write in plain text, no markdown headers"""


REPLY_PROMPTS = {
    "professional": """Write a professional, authoritative response to this Reddit post from a restaurant operations expert.
Tone: Professional, knowledgeable, solution-focused.
Length: 200-350 words.

Post Title: {title}
Post Content: {body}
Subreddit: r/{subreddit}
Category: {category}
Key Issues: {summary}

Write only the reply text, nothing else.""",

    "friendly": """Write a warm, conversational response to this Reddit post from a fellow restaurant owner.
Tone: Friendly, relatable, empathetic - like talking to a colleague.
Length: 150-300 words.

Post Title: {title}
Post Content: {body}
Subreddit: r/{subreddit}
Category: {category}
Key Issues: {summary}

Write only the reply text, nothing else.""",

    "educational": """Write an educational, informative response to this Reddit post that teaches something valuable.
Tone: Helpful teacher sharing industry knowledge, includes specific tips or frameworks.
Length: 250-400 words.

Post Title: {title}
Post Content: {body}
Subreddit: r/{subreddit}
Category: {category}
Key Issues: {summary}

Write only the reply text, nothing else.""",
}


class ReplyGenerator:
    def __init__(self, config: dict):
        self.config = config
        self.ollama = OllamaClient(
            host=config["ollama"]["host"],
            model=config["scoring"]["model"],
            timeout=config["ollama"]["timeout"],
        )
        self.styles = config["reply_generation"]["styles"]

    def generate_reply(self, post: RedditPost, analysis: PostAnalysis, style: str) -> str | None:
        prompt_template = REPLY_PROMPTS.get(style)
        if not prompt_template:
            logger.warning(f"Unknown reply style: {style}")
            return None

        prompt = prompt_template.format(
            title=post.title,
            body=post.body[:1500] if post.body else "(no body)",
            subreddit=post.subreddit,
            category=analysis.category,
            summary=analysis.summary,
        )

        try:
            reply = self.ollama.generate(prompt=prompt, system=REPLY_SYSTEM_PROMPT)
            if reply:
                logger.debug(f"Generated {style} reply for post {post.reddit_id}")
            return reply
        except Exception as e:
            logger.error(f"Failed to generate {style} reply: {e}")
            return None

    def generate_all_replies(self, post: RedditPost, analysis: PostAnalysis) -> list[GeneratedReply]:
        replies = []
        for style in self.styles:
            content = self.generate_reply(post, analysis, style)
            if content:
                reply = GeneratedReply(
                    post_id=post.id,
                    style=style,
                    content=content,
                )
                replies.append(reply)

        return replies

    def process_pending_posts(self, limit: int = 5) -> list[GeneratedReply]:
        all_replies = []
        with get_db() as session:
            pairs = (
                session.query(RedditPost, PostAnalysis)
                .join(PostAnalysis)
                .filter(PostAnalysis.opportunity_score >= self.config["scoring"]["min_score_for_alert"])
                .outerjoin(GeneratedReply, GeneratedReply.post_id == RedditPost.id)
                .filter(GeneratedReply.id == None)
                .order_by(PostAnalysis.opportunity_score.desc())
                .limit(limit)
                .all()
            )

            for post, analysis in pairs:
                replies = self.generate_all_replies(post, analysis)
                for reply in replies:
                    session.add(reply)
                all_replies.extend(replies)

        logger.info(f"Generated {len(all_replies)} reply drafts")
        return all_replies
