"""Shared pytest fixtures for the Flask migration test-suite.

These tests are written to run against the *integrated* Flask app
(``from app import app``) while the application is still being assembled
in parallel by other sessions. To keep the suite green and useful at
every stage of the migration we:

* mock the database layer entirely (no MongoDB / MySQL server required), and
* skip — with a clear reason — whenever a piece of the app has not been
  wired up yet (e.g. ``models.mongo`` does not exist or the route
  blueprints are not registered).

Once integration lands, the same fixtures patch the in-memory fakes into
place and the tests exercise the real route handlers.
"""

import importlib
import sys
import types

import pytest
from unittest.mock import MagicMock


# ---------------------------------------------------------------------------
# In-memory fakes for the pymongo collections
# ---------------------------------------------------------------------------

class FakeCursor(list):
    """A ``list`` that also answers the pymongo cursor chaining API.

    Route handlers do things like ``todos.find({}).sort('-updated_at')`` so
    ``find`` must return something that is both iterable *and* supports the
    ``sort``/``limit``/``skip`` chain.
    """

    def sort(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def skip(self, *args, **kwargs):
        return self


def _matches(doc, query):
    """Very small query matcher.

    Plain ``key == value`` pairs must match exactly. Mongo *operator*
    documents (e.g. ``{"$gt": ""}``) are treated as "matches anything" so
    that the deliberate NoSQL-injection vulnerability is reproduced: an
    attacker-supplied operator payload always finds a user.
    """
    for key, value in (query or {}).items():
        if isinstance(value, dict):
            # operator query such as {"$gt": ""} -> intentionally permissive
            continue
        if doc.get(key) != value:
            return False
    return True


class FakeUsersCollection:
    """In-memory stand-in for ``models.mongo.users``."""

    def __init__(self, docs=None):
        self.docs = list(docs or [])

    def find_one(self, query=None, *args, **kwargs):
        for doc in self.docs:
            if _matches(doc, query):
                return doc
        return None

    def find(self, query=None, *args, **kwargs):
        return FakeCursor([d for d in self.docs if _matches(d, query)])

    def insert_one(self, doc, *args, **kwargs):
        self.docs.append(doc)
        return MagicMock(inserted_id=doc.get("_id"))


class FakeTodosCollection:
    """In-memory stand-in for ``models.mongo.todos``."""

    def __init__(self, docs=None):
        self.docs = list(docs or [])

    def find(self, query=None, *args, **kwargs):
        return FakeCursor(list(self.docs))

    def find_one(self, query=None, *args, **kwargs):
        return self.docs[0] if self.docs else {"_id": "x", "content": "stub"}

    def insert_one(self, doc, *args, **kwargs):
        self.docs.append(doc)
        return MagicMock(inserted_id="000000000000000000000000")

    def update_one(self, *args, **kwargs):
        return MagicMock(matched_count=1, modified_count=1)

    def replace_one(self, *args, **kwargs):
        return MagicMock(matched_count=1, modified_count=1)

    def delete_one(self, *args, **kwargs):
        return MagicMock(deleted_count=1)

    def count_documents(self, *args, **kwargs):
        return len(self.docs)


# A valid 24-char hex string so ``ObjectId(<id>)`` never raises in handlers.
VALID_OBJECT_ID = "0" * 24

# Seed data used by the authentication tests.
VALID_USERNAME = "user@example.com"
VALID_PASSWORD = "secret"


def _make_users():
    return FakeUsersCollection(
        [
            {
                "_id": VALID_OBJECT_ID,
                "username": VALID_USERNAME,
                "password": VALID_PASSWORD,
            }
        ]
    )


def _make_todos():
    return FakeTodosCollection(
        [{"_id": VALID_OBJECT_ID, "content": "existing todo", "updated_at": 0}]
    )


# ---------------------------------------------------------------------------
# Patching helpers
# ---------------------------------------------------------------------------

def _rebind_collection(monkeypatch, attr, fake):
    """Rebind ``attr`` (e.g. ``users``/``todos``) to ``fake`` everywhere it
    was imported as a module-level name.

    Handlers that did ``from models.mongo import users, todos`` hold their own
    reference, so patching ``models.mongo.users`` alone is not enough. We scan
    every already-imported ``app``/``models``/``routes`` module and rebind the
    name wherever it currently points at a non-module object (so we never
    clobber the ``routes.users`` *submodule*). Scanning ``sys.modules`` rather
    than a hardcoded list means any future handler submodule
    (e.g. ``routes.main``, ``routes.todos``) is covered automatically.
    """
    for mod_name, mod in list(sys.modules.items()):
        if mod is None:
            continue
        if not (
            mod_name == "app"
            or mod_name == "models"
            or mod_name == "routes"
            or mod_name.startswith("models.")
            or mod_name.startswith("routes.")
        ):
            continue
        current = getattr(mod, attr, None)
        if current is None or isinstance(current, types.ModuleType):
            continue
        monkeypatch.setattr(mod, attr, fake, raising=False)


def _ensure_blueprints(flask_app):
    """Register the route blueprints if the integrated ``app`` did not."""
    try:
        routes = importlib.import_module("routes")
    except Exception:
        return
    if "main" not in flask_app.blueprints and hasattr(routes, "main_bp"):
        try:
            flask_app.register_blueprint(routes.main_bp)
        except Exception:
            pass
    try:
        users_module = importlib.import_module("routes.users")
    except Exception:
        users_module = None
    if (
        users_module is not None
        and "users" not in flask_app.blueprints
        and hasattr(users_module, "users_bp")
    ):
        try:
            flask_app.register_blueprint(users_module.users_bp)
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def fake_users():
    return _make_users()


@pytest.fixture
def fake_todos():
    return _make_todos()


@pytest.fixture
def app(monkeypatch, fake_users, fake_todos):
    """Return the Flask app object with the DB layer fully mocked.

    Skips when the migration has not progressed far enough for the test to be
    meaningful (no ``models.mongo`` module, or no ``main`` blueprint).
    """
    mongo = pytest.importorskip(
        "models.mongo",
        reason="models.mongo not implemented yet (Flask migration in progress)",
    )

    # Neutralise DB initialisation and swap in the in-memory collections at
    # the source module *before* (re)importing the app.
    monkeypatch.setattr(mongo, "init_mongo", lambda *a, **k: None, raising=False)
    monkeypatch.setattr(mongo, "users", fake_users, raising=False)
    monkeypatch.setattr(mongo, "todos", fake_todos, raising=False)
    monkeypatch.setattr(mongo, "db", MagicMock(), raising=False)

    # The MySQL layer is optional for these tests; stub it if present so app
    # import never attempts a real connection.
    try:
        mysql = importlib.import_module("models.mysql")
    except Exception:
        mysql = None
    if mysql is not None:
        monkeypatch.setattr(mysql, "init_mysql", lambda *a, **k: None, raising=False)
        monkeypatch.setattr(mysql, "SessionLocal", MagicMock(), raising=False)

    # Import the app fresh so create_app() runs with the patches in place.
    # Use monkeypatch.delitem so the original sys.modules['app'] entry is
    # restored on teardown and no stale (mock-wired) module leaks between tests.
    monkeypatch.delitem(sys.modules, "app", raising=False)
    try:
        app_module = importlib.import_module("app")
    except Exception as exc:  # pragma: no cover - depends on integration state
        pytest.skip("app module could not be imported yet: %r" % (exc,))

    flask_app = getattr(app_module, "app", None)
    if flask_app is None:
        pytest.skip("`from app import app` is not available yet")

    _ensure_blueprints(flask_app)

    # Rebind collections for handlers that imported them by name.
    _rebind_collection(monkeypatch, "users", fake_users)
    _rebind_collection(monkeypatch, "todos", fake_todos)

    if "main" not in flask_app.blueprints:
        pytest.skip("routes.main_bp not registered yet (Flask migration in progress)")

    flask_app.config.update(TESTING=True, WTF_CSRF_ENABLED=False)
    return flask_app


@pytest.fixture
def client(app):
    return app.test_client()
