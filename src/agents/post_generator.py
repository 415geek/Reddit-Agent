import random
from datetime import datetime
from loguru import logger

from ..database.db import get_db
from ..database.models import GeneratedPost
from ..utils.ollama_client import OllamaClient


POST_SYSTEM_PROMPT = """You are an experienced restaurant industry veteran sharing genuine knowledge and insights.
Write content that restaurant owners, operators, and industry professionals will find valuable and engaging.

Rules:
- Write as an industry insider, not a marketer
- Include specific, actionable advice
- Use real examples and scenarios
- Never be promotional or salesy
- Sound like a real person who has operated restaurants
- Keep titles concise and engaging"""


POST_TEMPLATES = {
    "industry_insights": {
        "subreddits": ["restaurateur", "restaurantowners", "restaurant"],
        "prompt": """Write a Reddit post sharing an important industry insight about restaurant technology trends in {year}.
Focus on: delivery platform economics, POS integration challenges, or data-driven operations.

Format:
TITLE: <engaging title>
---
BODY:
<post body, 300-500 words>""",
    },
    "pos_migration": {
        "subreddits": ["restaurateur", "restaurantowners"],
        "prompt": """Write a Reddit post sharing practical advice about switching POS systems.
Include: common mistakes to avoid, how to evaluate options, migration timeline tips.

Format:
TITLE: <engaging title>
---
BODY:
<post body, 300-500 words>""",
    },
    "delivery_optimization": {
        "subreddits": ["restaurateur", "restaurantowners", "restaurant"],
        "prompt": """Write a Reddit post with practical tips for optimizing delivery operations (DoorDash, UberEats, etc.).
Include: commission negotiation, menu optimization, packaging tips, profit margin strategies.

Format:
TITLE: <engaging title>
---
BODY:
<post body, 300-500 words>""",
    },
    "new_restaurant_tech": {
        "subreddits": ["restaurateur", "entrepreneur"],
        "prompt": """Write a Reddit post about technology decisions for someone opening a new restaurant.
Include: what to prioritize, common tech mistakes, budget considerations.

Format:
TITLE: <engaging title>
---
BODY:
<post body, 300-500 words>""",
    },
    "operations_tips": {
        "subreddits": ["restaurateur", "restaurantowners", "restaurant", "smallbusiness"],
        "prompt": """Write a Reddit post sharing operational tips that helped your restaurant run more efficiently.
Focus on: staff management, inventory, table turnover, or customer experience.

Format:
TITLE: <engaging title>
---
BODY:
<post body, 300-500 words>""",
    },
}


class PostGenerator:
    def __init__(self, config: dict):
        self.config = config
        self.ollama = OllamaClient(
            host=config["ollama"]["host"],
            model=config["scoring"]["model"],
            timeout=config["ollama"]["timeout"],
        )

    def _parse_generated_content(self, raw: str) -> tuple[str, str]:
        if "---" in raw:
            parts = raw.split("---", 1)
            title_part = parts[0].strip()
            body = parts[1].strip() if len(parts) > 1 else ""
            title = title_part.replace("TITLE:", "").strip()
            body = body.replace("BODY:", "").strip()
        else:
            lines = raw.strip().split("\n")
            title = lines[0].replace("TITLE:", "").strip()
            body = "\n".join(lines[1:]).replace("BODY:", "").strip()

        return title, body

    def generate_post(self, topic_key: str = None) -> GeneratedPost | None:
        if topic_key is None:
            topic_key = random.choice(list(POST_TEMPLATES.keys()))

        template = POST_TEMPLATES.get(topic_key)
        if not template:
            logger.error(f"Unknown post topic: {topic_key}")
            return None

        prompt = template["prompt"].format(year=datetime.now().year)
        subreddit = random.choice(template["subreddits"])

        try:
            raw = self.ollama.generate(prompt=prompt, system=POST_SYSTEM_PROMPT)
            if not raw:
                return None

            title, body = self._parse_generated_content(raw)
            if not title or not body:
                logger.warning(f"Could not parse generated post for topic {topic_key}")
                return None

            post = GeneratedPost(
                title=title,
                body=body,
                topic=topic_key,
                target_subreddit=subreddit,
            )
            logger.info(f"Generated post: [{topic_key}] {title[:60]}...")
            return post

        except Exception as e:
            logger.error(f"Failed to generate post for topic {topic_key}: {e}")
            return None

    def generate_weekly_batch(self) -> list[GeneratedPost]:
        posts = []
        with get_db() as session:
            for topic_key in POST_TEMPLATES.keys():
                post = self.generate_post(topic_key)
                if post:
                    session.add(post)
                    posts.append(post)

        logger.info(f"Generated weekly batch: {len(posts)} posts")
        return posts
