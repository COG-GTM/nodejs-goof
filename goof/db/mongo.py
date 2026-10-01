"""MongoDB connection and helpers (port of mongoose-db.js).

Provides access to the ``todos`` and ``users`` collections of the
``express-todo`` database and seeds the default admin user.
"""
import os

from pymongo import MongoClient

# Default Mongo URI is local. Mirror the Node app's environment handling.
if os.environ.get("DOCKER") == "1":
    mongo_uri = "mongodb://goof-mongo/express-todo"
else:
    mongo_uri = "mongodb://localhost/express-todo"

if os.environ.get("MONGOLAB_URI"):
    mongo_uri = os.environ["MONGOLAB_URI"]
elif os.environ.get("MONGODB_URI"):
    mongo_uri = os.environ["MONGODB_URI"]

print("Using Mongo URI " + mongo_uri)

# ``serverSelectionTimeoutMS`` keeps the app responsive when Mongo is down.
_client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2000)
_db = _client.get_default_database()


def get_db():
    return _db


def todos():
    return _db["todos"]


def users():
    return _db["users"]


def seed_admin():
    """Create the default admin user if it does not already exist."""
    try:
        existing = list(users().find({"username": "admin@snyk.io"}))
        print(existing)
        if len(existing) == 0:
            print("no admin")
            users().insert_one(
                {"username": "admin@snyk.io", "password": "SuperSecretPassword"}
            )
    except Exception as err:  # noqa: BLE001 - tolerate Mongo being unavailable
        print("error saving admin user")
        print(err)
