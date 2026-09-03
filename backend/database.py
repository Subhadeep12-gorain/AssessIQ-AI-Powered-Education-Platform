"""
database.py — Async SQLAlchemy engine + session factory

What this file does:
  - Creates an async SQLite engine (the actual file: assessiq.db)
  - Provides `AsyncSession` which every route uses to talk to the DB
  - `create_all_tables()` is called once at startup to create all tables
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from dotenv import load_dotenv
import os

# Load values from .env file
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./assessiq.db")

# The async engine — think of it as the "connection" to assessiq.db
engine = create_async_engine(
    DATABASE_URL,
    echo=False,        # Set to True to see every SQL query in the terminal (useful for debugging)
    future=True,
)

# Session factory — every request gets its own session (like a DB transaction)
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# Base class that all our models (User, Quiz, etc.) will inherit from
class Base(DeclarativeBase):
    pass


async def create_all_tables():
    """
    Creates all tables in the database if they don't exist yet.
    Called once when the FastAPI app starts.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
