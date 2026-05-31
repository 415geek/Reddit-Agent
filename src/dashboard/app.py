import os
import sys
from pathlib import Path

# Ensure project root is on path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import streamlit as st

st.set_page_config(
    page_title="Restaurant Intelligence Agent",
    page_icon="🍽️",
    layout="wide",
    initial_sidebar_state="expanded",
)

from dotenv import load_dotenv
load_dotenv()

from src.database.db import init_db, get_db
from src.database.models import (
    RedditPost, PostAnalysis, GeneratedReply, GeneratedPost,
    Lead, PublishingHistory, ApprovalStatus
)

init_db()


def sidebar():
    st.sidebar.title("🍽️ Restaurant Intelligence")
    st.sidebar.markdown("---")
    page = st.sidebar.radio(
        "Navigate",
        ["Overview", "Opportunities", "Competitor Mentions", "Leads", "Generated Replies", "Generated Posts", "Publishing History", "Settings"],
    )
    st.sidebar.markdown("---")
    st.sidebar.caption("Reddit Intelligence Agent v1.0")
    return page


def page_overview():
    st.title("📊 Overview Dashboard")

    from datetime import datetime, timedelta
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    last_7 = datetime.utcnow() - timedelta(days=7)

    with get_db() as session:
        total_posts = session.query(RedditPost).count()
        posts_today = session.query(RedditPost).filter(RedditPost.collected_at >= today).count()
        posts_week = session.query(RedditPost).filter(RedditPost.collected_at >= last_7).count()

        high_opp = session.query(PostAnalysis).filter(PostAnalysis.opportunity_score >= 6).count()
        total_leads = session.query(Lead).count()
        saved_leads = session.query(Lead).filter_by(is_saved=True).count()

        pending_replies = session.query(GeneratedReply).filter_by(approval_status=ApprovalStatus.PENDING).count()
        published_replies = session.query(GeneratedReply).filter_by(approval_status=ApprovalStatus.PUBLISHED).count()

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Posts Today", posts_today, f"+{posts_today} from yesterday" if posts_today else "")
    col2.metric("Posts This Week", posts_week)
    col3.metric("Opportunities Found", high_opp)
    col4.metric("Leads Detected", total_leads)

    col5, col6, col7, col8 = st.columns(4)
    col5.metric("Saved Leads", saved_leads)
    col6.metric("Replies Pending", pending_replies)
    col7.metric("Replies Published", published_replies)
    col8.metric("Total Posts Collected", total_posts)

    st.markdown("---")

    with get_db() as session:
        import pandas as pd
        recent = (
            session.query(RedditPost, PostAnalysis)
            .join(PostAnalysis)
            .filter(PostAnalysis.opportunity_score >= 5)
            .order_by(PostAnalysis.opportunity_score.desc())
            .limit(10)
            .all()
        )

        if recent:
            st.subheader("🔥 Recent High-Priority Opportunities")
            rows = []
            for post, analysis in recent:
                rows.append({
                    "Subreddit": f"r/{post.subreddit}",
                    "Title": post.title[:80],
                    "Opp Score": f"{analysis.opportunity_score:.1f}",
                    "Lead Score": f"{analysis.lead_score:.1f}",
                    "Category": analysis.category,
                    "URL": post.url,
                })
            df = pd.DataFrame(rows)
            st.dataframe(df, use_container_width=True, hide_index=True)

    _competitor_summary_chart()


def _competitor_summary_chart():
    from datetime import timedelta
    import pandas as pd
    import plotly.express as px

    last_30 = __import__("datetime").datetime.utcnow() - timedelta(days=30)

    with get_db() as session:
        analyses = (
            session.query(PostAnalysis)
            .join(RedditPost)
            .filter(RedditPost.collected_at >= last_30)
            .all()
        )

    competitor_counts = {}
    for a in analyses:
        for comp in (a.competitor_mentions or []):
            competitor_counts[comp] = competitor_counts.get(comp, 0) + 1

    if not competitor_counts:
        return

    st.subheader("🏆 Competitor Mentions (Last 30 Days)")
    df = pd.DataFrame(
        list(competitor_counts.items()),
        columns=["Competitor", "Mentions"]
    ).sort_values("Mentions", ascending=False)

    fig = px.bar(df, x="Competitor", y="Mentions", color="Mentions",
                 color_continuous_scale="Reds", title="")
    fig.update_layout(showlegend=False, margin=dict(l=0, r=0, t=0, b=0))
    st.plotly_chart(fig, use_container_width=True)


def page_opportunities():
    st.title("🎯 Opportunities")

    min_score = st.slider("Minimum Opportunity Score", 0, 10, 6)
    category_filter = st.selectbox(
        "Category Filter",
        ["All", "Competitor Complaint", "POS Shopping Intent", "New Restaurant Opening",
         "Technology Discussion", "General Discussion"],
    )

    with get_db() as session:
        query = (
            session.query(RedditPost, PostAnalysis)
            .join(PostAnalysis)
            .filter(PostAnalysis.opportunity_score >= min_score)
        )
        if category_filter != "All":
            query = query.filter(PostAnalysis.category == category_filter)
        results = query.order_by(PostAnalysis.opportunity_score.desc()).limit(50).all()

    if not results:
        st.info("No opportunities matching the current filters.")
        return

    for post, analysis in results:
        with st.expander(f"[{post.subreddit}] {post.title[:100]} — Score: {analysis.opportunity_score:.1f}"):
            col1, col2 = st.columns([2, 1])
            with col1:
                st.markdown(f"**Summary:** {analysis.summary}")
                if post.body:
                    st.markdown(f"**Post Body:**\n{post.body[:500]}")
                st.markdown(f"[View on Reddit]({post.url})")
            with col2:
                st.metric("Opportunity", f"{analysis.opportunity_score:.1f}/10")
                st.metric("Lead Score", f"{analysis.lead_score:.1f}/10")
                st.write(f"**Category:** {analysis.category}")
                st.write(f"**Sentiment:** {analysis.sentiment}")
                if analysis.competitor_mentions:
                    st.write(f"**Competitors:** {', '.join(analysis.competitor_mentions)}")
                st.write(f"**Author:** u/{post.author}")
                st.write(f"**r/{post.subreddit}** · {post.score} upvotes")


def page_competitors():
    st.title("🏆 Competitor Mentions")

    import pandas as pd
    import plotly.express as px
    from datetime import timedelta

    days = st.selectbox("Time Range", [7, 14, 30, 90], index=2)
    since = __import__("datetime").datetime.utcnow() - timedelta(days=days)

    with get_db() as session:
        analyses = (
            session.query(PostAnalysis, RedditPost)
            .join(RedditPost)
            .filter(RedditPost.collected_at >= since)
            .all()
        )

    competitor_data = {}
    for analysis, post in analyses:
        for comp in (analysis.competitor_mentions or []):
            if comp not in competitor_data:
                competitor_data[comp] = {"count": 0, "posts": []}
            competitor_data[comp]["count"] += 1
            if len(competitor_data[comp]["posts"]) < 5:
                competitor_data[comp]["posts"].append((post, analysis))

    if not competitor_data:
        st.info("No competitor mentions found in the selected period.")
        return

    counts_df = pd.DataFrame(
        [(k, v["count"]) for k, v in competitor_data.items()],
        columns=["Competitor", "Mentions"]
    ).sort_values("Mentions", ascending=False)

    col1, col2 = st.columns([1, 2])
    with col1:
        st.dataframe(counts_df, hide_index=True, use_container_width=True)
    with col2:
        fig = px.pie(counts_df, values="Mentions", names="Competitor", title="Share of Mentions")
        st.plotly_chart(fig, use_container_width=True)

    st.markdown("---")
    selected = st.selectbox("View posts mentioning:", list(competitor_data.keys()))
    if selected:
        for post, analysis in competitor_data[selected]["posts"]:
            with st.expander(f"{post.title[:100]}"):
                st.write(f"**r/{post.subreddit}** | Score: {post.score} | u/{post.author}")
                st.write(f"**Opportunity Score:** {analysis.opportunity_score:.1f}")
                st.write(f"**Summary:** {analysis.summary}")
                st.markdown(f"[View Post]({post.url})")


def page_leads():
    st.title("👥 Lead Opportunities")

    import pandas as pd

    show_saved = st.checkbox("Show saved leads only", value=False)

    with get_db() as session:
        query = session.query(Lead, RedditPost).join(RedditPost)
        if show_saved:
            query = query.filter_by(is_saved=True)
        leads = query.order_by(Lead.lead_score.desc()).all()

    if not leads:
        st.info("No leads detected yet.")
        return

    rows = []
    for lead, post in leads:
        rows.append({
            "Username": f"u/{lead.reddit_username}",
            "Subreddit": f"r/{lead.subreddit}",
            "Type": lead.lead_type.replace("_", " ").title(),
            "Lead Score": f"{lead.lead_score:.1f}",
            "Saved": "✅" if lead.is_saved else "❌",
            "Title": post.title[:80],
            "URL": post.url,
        })

    df = pd.DataFrame(rows)
    st.dataframe(df, use_container_width=True, hide_index=True)

    st.markdown("---")
    st.subheader("Lead Details")
    for lead, post in leads[:10]:
        with st.expander(f"u/{lead.reddit_username} — {lead.lead_type.replace('_', ' ').title()} [{lead.lead_score:.1f}/10]"):
            col1, col2 = st.columns([2, 1])
            with col1:
                st.write(f"**Post:** {post.title}")
                st.write(f"**Notes:** {lead.notes}")
                st.markdown(f"[View Post]({post.url})")
            with col2:
                st.metric("Lead Score", f"{lead.lead_score:.1f}/10")
                saved_val = "Yes" if lead.is_saved else "No"
                st.write(f"**Saved:** {saved_val}")
                st.write(f"**Detected:** {lead.created_at.strftime('%Y-%m-%d')}")


def page_replies():
    st.title("💬 Generated Replies")

    status_filter = st.selectbox(
        "Status",
        ["All", "Pending", "Approved", "Edited", "Published", "Skipped"],
    )

    with get_db() as session:
        query = session.query(GeneratedReply, RedditPost).join(RedditPost)
        if status_filter != "All":
            query = query.filter(GeneratedReply.approval_status == status_filter.lower())
        replies = query.order_by(GeneratedReply.created_at.desc()).limit(30).all()

    if not replies:
        st.info("No replies found.")
        return

    for reply, post in replies:
        status_emoji = {
            "pending": "⏳", "approved": "✅", "edited": "✏️",
            "published": "🚀", "skipped": "⏭️"
        }.get(reply.approval_status, "❓")

        with st.expander(
            f"{status_emoji} [{reply.style.title()}] {post.title[:80]} — r/{post.subreddit}"
        ):
            st.write(f"**Status:** {reply.approval_status.title()}")
            st.write(f"**Style:** {reply.style.title()}")
            st.markdown(f"[View Original Post]({post.url})")
            st.markdown("---")
            st.text_area(
                "Reply Content",
                value=reply.edited_content or reply.content,
                height=200,
                key=f"reply_{reply.id}",
                disabled=True,
            )
            if reply.edited_content:
                st.caption("*(This is the edited version)*")


def page_posts():
    st.title("📝 Generated Posts")

    status_filter = st.selectbox(
        "Status",
        ["All", "Pending", "Approved", "Edited", "Skipped"],
    )

    with get_db() as session:
        query = session.query(GeneratedPost)
        if status_filter != "All":
            query = query.filter_by(approval_status=status_filter.lower())
        posts = query.order_by(GeneratedPost.created_at.desc()).limit(20).all()

    if not posts:
        st.info("No generated posts found.")
        return

    for post in posts:
        status_emoji = {
            "pending": "⏳", "approved": "✅", "edited": "✏️",
            "published": "🚀", "skipped": "⏭️"
        }.get(post.approval_status, "❓")

        with st.expander(f"{status_emoji} [{post.topic.replace('_', ' ').title()}] {post.title[:80]}"):
            col1, col2 = st.columns([3, 1])
            with col1:
                st.write(f"**Title:** {post.edited_title or post.title}")
                st.markdown("**Body:**")
                st.text_area(
                    "Content",
                    value=post.edited_body or post.body,
                    height=300,
                    key=f"post_{post.id}",
                    disabled=True,
                )
            with col2:
                st.write(f"**Target:** r/{post.target_subreddit}")
                st.write(f"**Topic:** {post.topic.replace('_', ' ').title()}")
                st.write(f"**Status:** {post.approval_status.title()}")
                st.write(f"**Created:** {post.created_at.strftime('%Y-%m-%d')}")


def page_history():
    st.title("📋 Publishing History")

    import pandas as pd

    with get_db() as session:
        history = (
            session.query(PublishingHistory)
            .order_by(PublishingHistory.published_at.desc())
            .limit(50)
            .all()
        )

    if not history:
        st.info("No publishing history yet.")
        return

    rows = [{
        "Type": h.content_type.title(),
        "Subreddit": f"r/{h.subreddit}",
        "Published At": h.published_at.strftime("%Y-%m-%d %H:%M"),
        "Approved By": h.approved_by,
        "Success": "✅" if h.success else "❌",
        "URL": h.reddit_url or "N/A",
    } for h in history]

    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)


def page_settings():
    st.title("⚙️ Settings")
    st.info("Configure the agent via the `.env` file and `config/config.yaml`.")

    config_path = Path("config/config.yaml")
    if config_path.exists():
        with open(config_path) as f:
            content = f.read()
        st.subheader("config/config.yaml")
        st.code(content, language="yaml")

    env_path = Path(".env")
    if env_path.exists():
        st.subheader("Active Environment Variables")
        st.info("Showing keys only (values hidden for security)")
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key = line.split("=")[0]
                    st.code(f"{key}=***")


def main():
    page = sidebar()
    pages = {
        "Overview": page_overview,
        "Opportunities": page_opportunities,
        "Competitor Mentions": page_competitors,
        "Leads": page_leads,
        "Generated Replies": page_replies,
        "Generated Posts": page_posts,
        "Publishing History": page_history,
        "Settings": page_settings,
    }
    pages.get(page, page_overview)()


if __name__ == "__main__":
    main()
