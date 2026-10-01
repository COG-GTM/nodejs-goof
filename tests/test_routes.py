"""Route tests for the migrated Flask app (todo CRUD + chat endpoints).

The Mongo ``todos``/``users`` collections are replaced with in-memory fakes
(see ``conftest.py``) so these run with no database. Chat endpoints use an
in-process user list in the app itself and need no DB mocking.
"""

from conftest import VALID_OBJECT_ID


def _is_redirect(response):
    return 300 <= response.status_code < 400


# ---------------------------------------------------------------------------
# Todo CRUD
# ---------------------------------------------------------------------------

def test_index_lists_todos(client):
    """GET '/' renders the todo list with the DB layer mocked."""
    resp = client.get("/")
    assert resp.status_code == 200, "expected index to render, got %s" % resp.status_code


def test_create_todo_redirects(client):
    """POST /create stores a todo and returns a redirect/302."""
    resp = client.post("/create", data={"content": "buy milk"})
    # The legacy handler responds 302 with a Location header rather than a
    # body redirect, so accept any 30x.
    assert _is_redirect(resp), (
        "expected create to redirect, got %s" % resp.status_code
    )


def test_update_todo_redirects(client):
    """POST /update/<id> updates a todo and redirects to '/'."""
    resp = client.post(
        "/update/%s" % VALID_OBJECT_ID,
        data={"content": "updated content"},
    )
    assert _is_redirect(resp), (
        "expected update to redirect, got %s" % resp.status_code
    )


def test_destroy_todo_redirects(client):
    """GET /destroy/<id> deletes a todo and redirects to '/'."""
    resp = client.get("/destroy/%s" % VALID_OBJECT_ID)
    assert _is_redirect(resp), (
        "expected destroy to redirect, got %s" % resp.status_code
    )


# ---------------------------------------------------------------------------
# Chat endpoints
# ---------------------------------------------------------------------------

def test_chat_get_returns_json(client):
    """GET /chat returns a JSON payload (the message list)."""
    resp = client.get("/chat")
    assert resp.status_code == 200, "expected 200 from GET /chat, got %s" % resp.status_code
    assert resp.is_json, "expected GET /chat to return JSON"
    assert resp.get_json() is not None


def test_chat_put_with_valid_auth_succeeds(client):
    """PUT /chat with valid auth for the known 'user' account succeeds."""
    payload = {
        # Provide the auth both nested (legacy shape) and flat to be robust
        # to the integrated handler's exact contract.
        "auth": {"name": "user", "password": "pwd"},
        "name": "user",
        "password": "pwd",
        "message": {"text": "hello world"},
    }
    resp = client.put("/chat", json=payload)
    assert resp.status_code != 403, "valid chat auth was unexpectedly rejected"
    assert resp.status_code in (200, 201), (
        "expected PUT /chat to succeed, got %s" % resp.status_code
    )


def test_chat_delete_without_can_delete_is_forbidden(client):
    """DELETE /chat as a user lacking canDelete is rejected with 403."""
    payload = {
        "auth": {"name": "user", "password": "pwd"},
        "name": "user",
        "password": "pwd",
        "messageId": 1,
    }
    resp = client.delete("/chat", json=payload)
    assert resp.status_code == 403, (
        "expected 403 deleting without canDelete, got %s" % resp.status_code
    )
