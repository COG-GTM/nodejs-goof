"""
MongoDB data layer for the (deliberately vulnerable) Goof TODO app.

Replaces the legacy ``mongoose-db.js``. Uses PyMongo directly with raw
collections (NOT an ODM) so that NoSQL injection via operator injection in
JSON request bodies remains exploitable, matching the original app.

INTENTIONAL: the seeded admin credentials are hardcoded for security
education purposes and must be preserved.
"""
import os

import pymongo


def _mongo_uri():
    """Resolve the Mongo connection URI using the same precedence as the
    legacy mongoose-db.js."""
    if os.environ.get("DOCKER") == "1":
        return "mongodb://goof-mongo/express-todo"
    if os.environ.get("MONGOLAB_URI"):
        return os.environ["MONGOLAB_URI"]
    if os.environ.get("MONGODB_URI"):
        return os.environ["MONGODB_URI"]
    return "mongodb://localhost/express-todo"


mongo_uri = _mongo_uri()

# Lazy connection: MongoClient does not block on a server at construction
# time, so importing this module never crashes when no server is running.
client = pymongo.MongoClient(mongo_uri)
db = client.get_database("express-todo")
todos = db.todos
users = db.users


def init_mongo():
    """Ensure the connection works and seed the hardcoded admin user.

    Performs the actual blocking server operations (ping + seed) so that they
    do not run at import time.
    """
    print("Using Mongo URI " + mongo_uri)
    client.admin.command("ping")

    # INTENTIONAL hardcoded admin credentials (security education).
    if users.find_one({"username": "admin@snyk.io"}) is None:
        print("no admin")
        users.insert_one(
            {"username": "admin@snyk.io", "password": "SuperSecretPassword"}
        )

    return db
