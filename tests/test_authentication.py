"""Tests for the Python port (pytest), replacing the legacy Jasmine spec."""
import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app as flask_app  # noqa: E402
from goof.routes.auth import _is_email  # noqa: E402


@pytest.fixture()
def client():
    flask_app.config.update(TESTING=True)
    with flask_app.test_client() as c:
        yield c


def test_is_email_accepts_valid_address():
    assert _is_email("admin@snyk.io") is True


def test_is_email_rejects_invalid_address():
    assert _is_email("not-an-email") is False


def test_is_email_allows_display_name():
    assert _is_email("Admin <admin@snyk.io>", allow_display_name=True) is True


def test_login_page_renders(client):
    resp = client.get("/login")
    assert resp.status_code == 200
    assert b"username" in resp.data


def test_admin_requires_login(client):
    resp = client.get("/admin")
    assert resp.status_code == 302
    assert resp.headers["Location"] == "/"


def test_chat_requires_auth(client):
    resp = client.put("/chat", json={"message": {"text": "hi"}})
    assert resp.status_code == 403


def test_chat_get_returns_list(client):
    resp = client.get("/chat")
    assert resp.status_code == 200
    assert isinstance(resp.get_json(), list)


def test_about_new_renders(client):
    resp = client.get("/about_new?device=Desktop")
    assert resp.status_code == 200
    assert b"BESTest todo app" in resp.data
