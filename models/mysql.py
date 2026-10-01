"""
MySQL data layer for the (deliberately vulnerable) Goof TODO app.

Replaces the legacy ``typeorm-db.js``. Uses SQLAlchemy to connect to the
``acme`` database and seeds two demo users on initialization.

INTENTIONAL: the hardcoded ``root:root`` credentials are preserved for
security education purposes.
"""
import os

from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.orm import sessionmaker

try:
    # SQLAlchemy >= 1.4
    from sqlalchemy.orm import declarative_base
except ImportError:  # pragma: no cover
    from sqlalchemy.ext.declarative import declarative_base


_host = "goof-mysql" if os.environ.get("DOCKER") == "1" else "localhost"
# INTENTIONAL hardcoded root:root credentials (security education).
DATABASE_URI = "mysql+pymysql://root:root@{host}:3306/acme".format(host=_host)

engine = create_engine(DATABASE_URI)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class Users(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255))
    address = Column(String(255))
    role = Column(String(255))


def init_mysql():
    """Create the schema and seed two demo users.

    Performs the blocking DB operations here (not at import time).
    """
    Base.metadata.create_all(engine)

    session = SessionLocal()
    try:
        print(
            "Seeding 2 users to MySQL users table: "
            "Liran (role: user), Simon (role: admin)"
        )
        session.add_all(
            [
                Users(name="Liran", address="IL", role="user"),
                Users(name="Simon", address="UK", role="admin"),
            ]
        )
        session.commit()
    finally:
        session.close()
