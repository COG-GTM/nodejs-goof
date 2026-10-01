"""MySQL connection and the ``Users`` model (port of typeorm-db.js + entity/Users.js)."""
from sqlalchemy import Column, Integer, String, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()


class Users(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255))
    address = Column(String(255))
    role = Column(String(255))


# Hard-coded local credentials mirroring the original demo config.
MYSQL_URL = "mysql+pymysql://root:root@localhost:3306/acme"

engine = create_engine(MYSQL_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_session():
    return SessionLocal()


def init_db():
    """Create the schema and seed two users (matches typeorm synchronize + seed)."""
    try:
        Base.metadata.create_all(engine)
        session = SessionLocal()
        try:
            if session.query(Users).count() == 0:
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
    except Exception as err:  # noqa: BLE001 - tolerate MySQL being unavailable
        print("failed connecting and seeding users to the MySQL database")
        print(err)
