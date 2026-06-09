"""Basic tests for the Flask port of goof.

These cover the pure helpers and the in-memory routes that do not require a
running database, so they are safe to run in CI.
"""

import goof_utils
import ms_util
import validators
from app import app


def test_ms_parse_and_format():
    assert ms_util.format(ms_util.parse("2 hours")) == "2h"
    assert ms_util.format(ms_util.parse("20 minutes")) == "20m"
    assert ms_util.parse("not a time") is None


def test_validators():
    assert validators.is_email("admin@snyk.io")
    assert not validators.is_email("nope")
    assert not validators.is_email({"$gt": ""})
    assert validators.is_email("Admin <admin@snyk.io>", allow_display_name=True)
    assert validators.is_mobile_phone("+972551234123", "he-IL")
    assert validators.is_ascii("abc")
    assert not validators.is_ascii("\u00e9")
    assert validators.rtrim("abc   ") == "abc"


def test_uid_length():
    assert len(goof_utils.uid(12)) == 12


def test_login_page_renders():
    client = app.test_client()
    resp = client.get("/login")
    assert resp.status_code == 200
    assert b"Admin Access" in resp.data


def test_about_new_ssti():
    client = app.test_client()
    resp = client.get("/about_new?device={{6*6}}")
    assert b"Device string (debug): 36" in resp.data


def test_chat_flow_in_memory():
    client = app.test_client()
    resp = client.put(
        "/chat",
        json={"auth": {"name": "user", "password": "pwd"}, "message": {"text": "Hi"}},
    )
    assert resp.get_json()["ok"] is True
    messages = client.get("/chat").get_json()
    assert any(m.get("text") == "Hi" for m in messages)


def test_chat_rejects_bad_auth():
    client = app.test_client()
    resp = client.put(
        "/chat",
        json={"auth": {"name": "user", "password": "wrong"}, "message": {"text": "x"}},
    )
    assert resp.status_code == 403
