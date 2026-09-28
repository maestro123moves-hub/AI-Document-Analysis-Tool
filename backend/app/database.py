from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# Async SQLAlchemy engine setup (empty for now, ready for business logic)
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
)

async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


# Import models here so Base.metadata is populated for Alembic autogenerate
from app.models.user import User  # noqa: F401, E402


async def get_db():
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()
