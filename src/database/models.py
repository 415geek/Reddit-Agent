from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Text, Boolean,
    DateTime, ForeignKey, JSON, Enum
)
from sqlalchemy.orm import DeclarativeBase, relationship
import enum


class Base(DeclarativeBase):
    pass


class OpportunityCategory(str, enum.Enum):
    COMPETITOR_COMPLAINT = "Competitor Complaint"
    POS_SHOPPING_INTENT = "POS Shopping Intent"
    NEW_RESTAURANT_OPENING = "New Restaurant Opening"
    TECHNOLOGY_DISCUSSION = "Technology Discussion"
    GENERAL_DISCUSSION = "General Discussion"


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EDITED = "edited"
    PUBLISHED = "published"
    SKIPPED = "skipped"


class RedditPost(Base):
    __tablename__ = "reddit_posts"

    id = Column(Integer, primary_key=True)
    reddit_id = Column(String(20), unique=True, nullable=False, index=True)
    title = Column(Text, nullable=False)
    body = Column(Text, default="")
    subreddit = Column(String(100), nullable=False, index=True)
    author = Column(String(100), default="[deleted]")
    url = Column(Text, nullable=False)
    score = Column(Integer, default=0)
    comment_count = Column(Integer, default=0)
    created_utc = Column(DateTime, nullable=False)
    collected_at = Column(DateTime, default=datetime.utcnow)
    matched_keywords = Column(JSON, default=list)
    is_processed = Column(Boolean, default=False)

    analysis = relationship("PostAnalysis", back_populates="post", uselist=False)
    replies = relationship("GeneratedReply", back_populates="post")
    lead = relationship("Lead", back_populates="post", uselist=False)


class RedditComment(Base):
    __tablename__ = "reddit_comments"

    id = Column(Integer, primary_key=True)
    reddit_id = Column(String(20), unique=True, nullable=False, index=True)
    post_reddit_id = Column(String(20), nullable=False, index=True)
    body = Column(Text, nullable=False)
    subreddit = Column(String(100), nullable=False, index=True)
    author = Column(String(100), default="[deleted]")
    score = Column(Integer, default=0)
    created_utc = Column(DateTime, nullable=False)
    collected_at = Column(DateTime, default=datetime.utcnow)
    matched_keywords = Column(JSON, default=list)
    is_processed = Column(Boolean, default=False)

    analysis = relationship("CommentAnalysis", back_populates="comment", uselist=False)


class PostAnalysis(Base):
    __tablename__ = "post_analyses"

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("reddit_posts.id"), unique=True)
    opportunity_score = Column(Float, default=0.0)
    lead_score = Column(Float, default=0.0)
    category = Column(String(50), default=OpportunityCategory.GENERAL_DISCUSSION)
    summary = Column(Text, default="")
    competitor_mentions = Column(JSON, default=list)
    sentiment = Column(String(20), default="neutral")
    is_restaurant_owner = Column(Boolean, default=False)
    is_evaluating_pos = Column(Boolean, default=False)
    is_new_restaurant = Column(Boolean, default=False)
    analyzed_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("RedditPost", back_populates="analysis")


class CommentAnalysis(Base):
    __tablename__ = "comment_analyses"

    id = Column(Integer, primary_key=True)
    comment_id = Column(Integer, ForeignKey("reddit_comments.id"), unique=True)
    opportunity_score = Column(Float, default=0.0)
    lead_score = Column(Float, default=0.0)
    category = Column(String(50), default=OpportunityCategory.GENERAL_DISCUSSION)
    summary = Column(Text, default="")
    competitor_mentions = Column(JSON, default=list)
    sentiment = Column(String(20), default="neutral")
    is_restaurant_owner = Column(Boolean, default=False)
    analyzed_at = Column(DateTime, default=datetime.utcnow)

    comment = relationship("RedditComment", back_populates="analysis")


class GeneratedReply(Base):
    __tablename__ = "generated_replies"

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("reddit_posts.id"))
    style = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    approval_status = Column(String(20), default=ApprovalStatus.PENDING)
    telegram_message_id = Column(Integer, nullable=True)
    edited_content = Column(Text, nullable=True)
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    post = relationship("RedditPost", back_populates="replies")


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("reddit_posts.id"), unique=True)
    reddit_username = Column(String(100), nullable=False)
    subreddit = Column(String(100), nullable=False)
    lead_score = Column(Float, default=0.0)
    lead_type = Column(String(50), default="unknown")
    notes = Column(Text, default="")
    is_saved = Column(Boolean, default=False)
    approval_status = Column(String(20), default=ApprovalStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("RedditPost", back_populates="lead")


class GeneratedPost(Base):
    __tablename__ = "generated_posts"

    id = Column(Integer, primary_key=True)
    title = Column(Text, nullable=False)
    body = Column(Text, nullable=False)
    topic = Column(String(200), nullable=False)
    target_subreddit = Column(String(100), nullable=False)
    approval_status = Column(String(20), default=ApprovalStatus.PENDING)
    telegram_message_id = Column(Integer, nullable=True)
    edited_title = Column(Text, nullable=True)
    edited_body = Column(Text, nullable=True)
    published_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PublishingHistory(Base):
    __tablename__ = "publishing_history"

    id = Column(Integer, primary_key=True)
    content_type = Column(String(20), nullable=False)
    content_id = Column(Integer, nullable=False)
    reddit_url = Column(Text, nullable=True)
    subreddit = Column(String(100), nullable=False)
    approved_by = Column(String(100), default="telegram_user")
    published_at = Column(DateTime, default=datetime.utcnow)
    success = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)


class SystemStats(Base):
    __tablename__ = "system_stats"

    id = Column(Integer, primary_key=True)
    stat_date = Column(DateTime, nullable=False, index=True)
    posts_collected = Column(Integer, default=0)
    comments_collected = Column(Integer, default=0)
    opportunities_found = Column(Integer, default=0)
    leads_found = Column(Integer, default=0)
    replies_generated = Column(Integer, default=0)
    replies_approved = Column(Integer, default=0)
    replies_published = Column(Integer, default=0)
    posts_generated = Column(Integer, default=0)
