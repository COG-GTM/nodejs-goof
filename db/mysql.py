"""MySQL connection and Users model (port of typeorm-db.js + entity/Users.js)."""

import os

from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()


class Users(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255))
    address = Column(String(255))
    role = Column(String(255))

    def as_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "address": self.address,
            "role": self.role,
        }


def _mysql_host():
    if os.environ.get("MYSQL_HOST"):
        return os.environ["MYSQL_HOST"]
    if os.environ.get("DOCKER") == "1":
        return "goof-mysql"
    return "localhost"


MYSQL_URI = "mysql+pymysql://root:root@%s:3306/acme" % _mysql_host()

engine = create_engine(MYSQL_URI, echo=True, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)


def init_and_seed():
    """Create the table and seed two users, matching the original seed."""
    Base.metadata.create_all(engine)

    session = SessionLocal()
    try:
        if session.query(Users).count() == 0:
            print(
                "Seeding 2 users to MySQL users table: "
                "Liran (role: user), Simon (role: admin"
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
