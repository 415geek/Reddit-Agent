import os
from pathlib import Path
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager
from loguru import logger

from .models import Base


_engine = None
_SessionLocal = None


def get_database_url() -> str:
    url = os.getenv("DATABASE_URL", "sqlite:///data/reddit_agent.db")
    if url.startswith("sqlite:///") and not url.startswith("sqlite:////"):
        db_path = url.replace("sqlite:///", "")
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    return url


def get_engine():
    global _engine
    if _engine is None:
        url = get_database_url()
        _engine = create_engine(
            url,
            connect_args={"check_same_thread": False} if "sqlite" in url else {},
            echo=False,
        )
        if "sqlite" in url:
            @event.listens_for(_engine, "connect")
            def set_sqlite_pragma(dbapi_connection, connection_record):
                cursor = dbapi_connection.cursor()
                cursor.execute("PRAGMA journal_mode=WAL")
                cursor.execute("PRAGMA foreign_keys=ON")
                cursor.close()
    return _engine


def get_session_factory():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=get_engine()
        )
    return _SessionLocal


def init_db():
    engine = get_engine()
    Base.metadata.create_all(bind=engine)
    logger.info("Database initialized")


@contextmanager
def get_db() -> Session:
    SessionLocal = get_session_factory()
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db_session() -> Session:
    SessionLocal = get_session_factory()
    return SessionLocal()
