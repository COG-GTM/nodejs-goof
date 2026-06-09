"""Authentication tests for the migrated Flask app.

All tests run against ``from app import app`` with the Mongo ``users``
collection replaced by an in-memory fake (see ``conftest.py``) so no real
database is required.
"""

from conftest import VALID_PASSWORD, VALID_USERNAME


def _is_redirect(response):
    return 300 <= response.status_code < 400


def test_login_valid_credentials_redirects(client):
    """A login with matching username/password should redirect (30x)."""
    resp = client.post(
        "/login",
        json={"username": VALID_USERNAME, "password": VALID_PASSWORD},
    )
    assert _is_redirect(resp), (
        "expected a redirect for valid credentials, got %s" % resp.status_code
    )


def test_login_invalid_credentials_unauthorized(client):
    """A login with credentials that match no user should return 401."""
    resp = client.post(
        "/login",
        json={"username": "ghost@example.com", "password": "wrong-password"},
    )
    assert resp.status_code == 401, (
        "expected 401 for invalid credentials, got %s" % resp.status_code
    )


def test_login_nosql_injection_succeeds(client):
    """NoSQL injection: operator payloads reach ``users.find_one`` and match.

    Posting ``{"$gt": ""}`` for both fields must NOT be rejected — the fake
    collection returns a user for the operator query, reproducing the
    deliberate vulnerability, so the endpoint should redirect rather than 401.
    """
    resp = client.post(
        "/login",
        json={"username": {"$gt": ""}, "password": {"$gt": ""}},
    )
    assert resp.status_code != 401, "NoSQL injection payload was unexpectedly rejected"
    assert _is_redirect(resp), (
        "expected NoSQL injection to yield a redirect, got %s" % resp.status_code
    )


def test_admin_requires_session_redirects_to_root(client):
    """GET /admin without a logged-in session redirects to '/'."""
    resp = client.get("/admin")
    assert _is_redirect(resp), (
        "expected unauthenticated /admin to redirect, got %s" % resp.status_code
    )
    location = resp.headers.get("Location", "")
    assert location.endswith("/") or location == "/", (
        "expected redirect to '/', got %r" % location
    )
