from datetime import datetime, timedelta
from telegram import Update, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.ext import ContextTypes
from loguru import logger

from ..database.db import get_db
from ..database.models import (
    RedditPost, PostAnalysis, GeneratedReply, GeneratedPost,
    Lead, PublishingHistory, ApprovalStatus
)


def format_score_bar(score: float, max_score: float = 10.0) -> str:
    filled = int((score / max_score) * 10)
    bar = "█" * filled + "░" * (10 - filled)
    return f"{bar} {score:.1f}/10"


def truncate(text: str, max_len: int = 200) -> str:
    return text[:max_len] + "..." if len(text) > max_len else text


async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = (
        "🤖 *Restaurant Intelligence Agent*\n\n"
        "Monitoring Reddit for restaurant tech opportunities.\n\n"
        "*Commands:*\n"
        "/summary - Daily summary\n"
        "/top - Top opportunities\n"
        "/leads - Lead list\n"
        "/competitors - Competitor mentions\n"
        "/stats - System statistics\n"
        "/posts - Generated content drafts\n"
        "/help - Show this message"
    )
    await update.message.reply_text(msg, parse_mode="Markdown")


async def cmd_summary(update: Update, context: ContextTypes.DEFAULT_TYPE):
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    with get_db() as session:
        posts_today = session.query(RedditPost).filter(RedditPost.collected_at >= today).count()
        opps_today = (
            session.query(PostAnalysis)
            .join(RedditPost)
            .filter(RedditPost.collected_at >= today)
            .filter(PostAnalysis.opportunity_score >= 6)
            .count()
        )
        leads_today = session.query(Lead).filter(Lead.created_at >= today).count()
        replies_pending = (
            session.query(GeneratedReply)
            .filter_by(approval_status=ApprovalStatus.PENDING)
            .count()
        )
        top_posts = (
            session.query(RedditPost, PostAnalysis)
            .join(PostAnalysis)
            .filter(RedditPost.collected_at >= today)
            .filter(PostAnalysis.opportunity_score >= 6)
            .order_by(PostAnalysis.opportunity_score.desc())
            .limit(3)
            .all()
        )

    msg = (
        f"📊 *Daily Summary — {today.strftime('%B %d, %Y')}*\n\n"
        f"Posts collected: {posts_today}\n"
        f"Opportunities found: {opps_today}\n"
        f"New leads: {leads_today}\n"
        f"Replies pending approval: {replies_pending}\n\n"
    )

    if top_posts:
        msg += "*Top Opportunities Today:*\n"
        for post, analysis in top_posts:
            msg += f"• [{post.subreddit}] {truncate(post.title, 80)} — Score: {analysis.opportunity_score:.1f}\n"

    await update.message.reply_text(msg, parse_mode="Markdown")


async def cmd_top(update: Update, context: ContextTypes.DEFAULT_TYPE):
    with get_db() as session:
        results = (
            session.query(RedditPost, PostAnalysis)
            .join(PostAnalysis)
            .filter(PostAnalysis.opportunity_score >= 6)
            .order_by(PostAnalysis.opportunity_score.desc())
            .limit(5)
            .all()
        )

    if not results:
        await update.message.reply_text("No high-priority opportunities found yet.")
        return

    for post, analysis in results:
        msg = (
            f"🎯 *New Opportunity*\n\n"
            f"*Subreddit:* r/{post.subreddit}\n"
            f"*Title:* {truncate(post.title, 100)}\n\n"
            f"*Opportunity Score:* {format_score_bar(analysis.opportunity_score)}\n"
            f"*Lead Score:* {format_score_bar(analysis.lead_score)}\n\n"
            f"*Category:* {analysis.category}\n"
            f"*Summary:* {truncate(analysis.summary, 300)}\n\n"
            f"[View Post]({post.url})"
        )
        await update.message.reply_text(msg, parse_mode="Markdown")


async def cmd_leads(update: Update, context: ContextTypes.DEFAULT_TYPE):
    with get_db() as session:
        leads = (
            session.query(Lead, RedditPost)
            .join(RedditPost)
            .order_by(Lead.lead_score.desc())
            .limit(10)
            .all()
        )

    if not leads:
        await update.message.reply_text("No leads detected yet.")
        return

    msg = "👥 *Recent Leads*\n\n"
    for lead, post in leads:
        status_emoji = "💾" if lead.is_saved else "🆕"
        msg += (
            f"{status_emoji} u/{lead.reddit_username} — r/{lead.subreddit}\n"
            f"   Type: {lead.lead_type.replace('_', ' ').title()}\n"
            f"   Score: {lead.lead_score:.1f}/10\n"
            f"   [{truncate(post.title, 60)}]({post.url})\n\n"
        )

    await update.message.reply_text(msg, parse_mode="Markdown", disable_web_page_preview=True)


async def cmd_competitors(update: Update, context: ContextTypes.DEFAULT_TYPE):
    last_7_days = datetime.utcnow() - timedelta(days=7)
    with get_db() as session:
        analyses = (
            session.query(PostAnalysis, RedditPost)
            .join(RedditPost)
            .filter(RedditPost.collected_at >= last_7_days)
            .filter(PostAnalysis.competitor_mentions != "[]")
            .order_by(RedditPost.collected_at.desc())
            .limit(20)
            .all()
        )

    competitor_counts = {}
    posts_by_competitor = {}

    for analysis, post in analyses:
        for comp in (analysis.competitor_mentions or []):
            competitor_counts[comp] = competitor_counts.get(comp, 0) + 1
            if comp not in posts_by_competitor:
                posts_by_competitor[comp] = []
            if len(posts_by_competitor[comp]) < 2:
                posts_by_competitor[comp].append(post)

    if not competitor_counts:
        await update.message.reply_text("No competitor mentions in the last 7 days.")
        return

    msg = "🏆 *Competitor Mentions — Last 7 Days*\n\n"
    for comp, count in sorted(competitor_counts.items(), key=lambda x: x[1], reverse=True):
        msg += f"*{comp}:* {count} mention{'s' if count != 1 else ''}\n"
        for post in posts_by_competitor.get(comp, []):
            msg += f"  • [{truncate(post.title, 60)}]({post.url})\n"
        msg += "\n"

    await update.message.reply_text(msg, parse_mode="Markdown", disable_web_page_preview=True)


async def cmd_stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    with get_db() as session:
        total_posts = session.query(RedditPost).count()
        total_leads = session.query(Lead).count()
        saved_leads = session.query(Lead).filter_by(is_saved=True).count()
        total_replies = session.query(GeneratedReply).count()
        approved_replies = session.query(GeneratedReply).filter_by(
            approval_status=ApprovalStatus.APPROVED
        ).count()
        published_replies = session.query(GeneratedReply).filter_by(
            approval_status=ApprovalStatus.PUBLISHED
        ).count()
        total_posts_gen = session.query(GeneratedPost).count()
        high_opp = (
            session.query(PostAnalysis)
            .filter(PostAnalysis.opportunity_score >= 8)
            .count()
        )

    msg = (
        "📈 *System Statistics*\n\n"
        f"*Data Collection:*\n"
        f"  Total posts collected: {total_posts}\n"
        f"  High-priority opportunities (8+): {high_opp}\n\n"
        f"*Leads:*\n"
        f"  Total leads detected: {total_leads}\n"
        f"  Saved leads: {saved_leads}\n\n"
        f"*Replies:*\n"
        f"  Reply drafts generated: {total_replies}\n"
        f"  Approved: {approved_replies}\n"
        f"  Published: {published_replies}\n\n"
        f"*Content:*\n"
        f"  Posts generated: {total_posts_gen}\n"
    )
    await update.message.reply_text(msg, parse_mode="Markdown")


async def cmd_posts(update: Update, context: ContextTypes.DEFAULT_TYPE):
    with get_db() as session:
        posts = (
            session.query(GeneratedPost)
            .filter_by(approval_status=ApprovalStatus.PENDING)
            .order_by(GeneratedPost.created_at.desc())
            .limit(5)
            .all()
        )

    if not posts:
        await update.message.reply_text("No pending content drafts.")
        return

    from .keyboards import post_approval_keyboard
    for post in posts:
        msg = (
            f"📝 *Generated Post Draft*\n\n"
            f"*Target:* r/{post.target_subreddit}\n"
            f"*Topic:* {post.topic.replace('_', ' ').title()}\n\n"
            f"*Title:*\n{post.title}\n\n"
            f"*Body Preview:*\n{truncate(post.body, 500)}"
        )
        await update.message.reply_text(
            msg,
            parse_mode="Markdown",
            reply_markup=post_approval_keyboard(post.id),
        )


async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data

    action, item_id = data.rsplit(":", 1)
    item_id = int(item_id)

    if action == "approve_reply":
        await _approve_reply(query, item_id)
    elif action == "edit_reply":
        await _request_edit(query, context, "reply", item_id)
    elif action == "skip_reply":
        await _skip_reply(query, item_id)
    elif action == "save_lead":
        await _save_lead_from_reply(query, item_id)
    elif action == "save_lead_direct":
        await _save_lead(query, item_id)
    elif action == "dismiss_lead":
        await _dismiss_lead(query, item_id)
    elif action == "approve_post":
        await _approve_post(query, item_id)
    elif action == "skip_post":
        await _skip_post(query, item_id)
    else:
        await query.edit_message_text(f"Unknown action: {action}")


async def _approve_reply(query, reply_id: int):
    with get_db() as session:
        reply = session.query(GeneratedReply).get(reply_id)
        if not reply:
            await query.edit_message_text("Reply not found.")
            return
        reply.approval_status = ApprovalStatus.APPROVED
        post = session.query(RedditPost).get(reply.post_id)
        post_url = post.url if post else "N/A"

    await query.edit_message_text(
        f"✅ Reply approved!\n\nPost URL for manual publishing:\n{post_url}\n\n"
        f"Copy the reply from the dashboard to publish manually.",
        parse_mode="Markdown",
    )
    logger.info(f"Reply {reply_id} approved by Telegram user")


async def _skip_reply(query, reply_id: int):
    with get_db() as session:
        reply = session.query(GeneratedReply).get(reply_id)
        if reply:
            reply.approval_status = ApprovalStatus.SKIPPED
    await query.edit_message_text("⏭️ Reply skipped.")


async def _save_lead_from_reply(query, reply_id: int):
    with get_db() as session:
        reply = session.query(GeneratedReply).get(reply_id)
        if not reply:
            await query.edit_message_text("Reply not found.")
            return
        lead = session.query(Lead).filter_by(post_id=reply.post_id).first()
        if lead:
            lead.is_saved = True
            await query.edit_message_text(f"💾 Lead saved: u/{lead.reddit_username}")
        else:
            await query.edit_message_text("No lead associated with this post.")


async def _save_lead(query, lead_id: int):
    with get_db() as session:
        lead = session.query(Lead).get(lead_id)
        if lead:
            lead.is_saved = True
            await query.edit_message_text(f"💾 Lead saved: u/{lead.reddit_username}")
        else:
            await query.edit_message_text("Lead not found.")


async def _dismiss_lead(query, lead_id: int):
    with get_db() as session:
        lead = session.query(Lead).get(lead_id)
        if lead:
            lead.approval_status = ApprovalStatus.REJECTED
    await query.edit_message_text("❌ Lead dismissed.")


async def _approve_post(query, post_id: int):
    with get_db() as session:
        post = session.query(GeneratedPost).get(post_id)
        if not post:
            await query.edit_message_text("Post not found.")
            return
        post.approval_status = ApprovalStatus.APPROVED

    await query.edit_message_text(
        f"✅ Post approved for publishing!\n\n"
        f"Target: r/{post.target_subreddit}\n"
        f"Please publish manually via the Reddit dashboard."
    )
    logger.info(f"Generated post {post_id} approved by Telegram user")


async def _skip_post(query, post_id: int):
    with get_db() as session:
        post = session.query(GeneratedPost).get(post_id)
        if post:
            post.approval_status = ApprovalStatus.SKIPPED
    await query.edit_message_text("⏭️ Post skipped.")


async def _request_edit(query, context, item_type: str, item_id: int):
    context.user_data["edit_type"] = item_type
    context.user_data["edit_id"] = item_id
    await query.edit_message_text(
        f"✏️ Send your edited {item_type} text as the next message.\n"
        f"Type /cancel to cancel editing."
    )


async def handle_edit_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if "edit_type" not in context.user_data:
        return

    edit_type = context.user_data.pop("edit_type")
    edit_id = context.user_data.pop("edit_id")
    new_content = update.message.text

    with get_db() as session:
        if edit_type == "reply":
            item = session.query(GeneratedReply).get(edit_id)
            if item:
                item.edited_content = new_content
                item.approval_status = ApprovalStatus.EDITED
                await update.message.reply_text("✅ Reply updated and marked as edited/approved.")
        elif edit_type == "post":
            item = session.query(GeneratedPost).get(edit_id)
            if item:
                item.edited_body = new_content
                item.approval_status = ApprovalStatus.EDITED
                await update.message.reply_text("✅ Post body updated and marked as edited/approved.")
