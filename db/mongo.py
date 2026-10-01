"""MongoDB connection and helpers (port of mongoose-db.js).

Holds the ``todos`` and ``users`` collections used by the app. The admin user is
seeded on startup, matching the original behaviour.
"""

import os

from pymongo import MongoClient


def _mongo_uri():
    if os.environ.get("DOCKER") == "1":
        uri = "mongodb://goof-mongo/express-todo"
    else:
        uri = "mongodb://localhost/express-todo"

    # Generic (plus Heroku) env var support
    if os.environ.get("MONGOLAB_URI"):
        uri = os.environ["MONGOLAB_URI"]
    elif os.environ.get("MONGODB_URI"):
        uri = os.environ["MONGODB_URI"]
    return uri


MONGO_URI = _mongo_uri()
print("Using Mongo URI " + MONGO_URI)

_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
_db = _client.get_default_database()

todos = _db["todos"]
users = _db["users"]


def seed_admin():
    """Create the default admin user if it does not exist yet."""
    existing = list(users.find({"username": "admin@snyk.io"}))
    print(existing)
    if len(existing) == 0:
        print("no admin")
        try:
            users.insert_one(
                {"username": "admin@snyk.io", "password": "SuperSecretPassword"}
            )
        except Exception:
            print("error saving admin user")
