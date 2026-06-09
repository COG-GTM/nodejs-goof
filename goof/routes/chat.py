"""Chat routes (port of the prototype-pollution chat handlers in routes/index.js)."""
import random
import time

from flask import Blueprint, jsonify, request

bp = Blueprint("chat", __name__)

# In order of simplicity we are not using any database.
_users = [
    # You know the password for the user.
    {"name": "user", "password": "pwd"},
    # You don't know the password for the admin.
    {"name": "admin", "password": str(random.random()), "canDelete": True},
]

_messages = []
_state = {"lastId": 1}


def _find_user(auth):
    for u in _users:
        if u["name"] == auth.get("name") and u["password"] == auth.get("password"):
            return u
    return None


def _merge(target, *sources):
    """Recursive merge mirroring lodash.merge (prototype-pollution goof)."""
    for source in sources:
        if not isinstance(source, dict):
            continue
        for key, value in source.items():
            if isinstance(value, dict) and isinstance(target.get(key), dict):
                _merge(target[key], value)
            else:
                target[key] = value
    return target


@bp.route("/chat", methods=["GET"])
def get():
    return jsonify(_messages)


@bp.route("/chat", methods=["PUT"])
def add():
    body = request.get_json(silent=True) or {}
    user = _find_user(body.get("auth") or {})
    if not user:
        return jsonify({"ok": False, "error": "Access denied"}), 403

    # Default message icon. Can be overwritten by user.
    message = {"icon": "\U0001f44b"}
    _merge(
        message,
        body.get("message"),
        {
            "id": _state["lastId"],
            "timestamp": int(time.time() * 1000),
            "userName": user["name"],
        },
    )
    _state["lastId"] += 1
    _messages.append(message)
    return jsonify({"ok": True})


@bp.route("/chat", methods=["DELETE"])
def delete():
    body = request.get_json(silent=True) or {}
    user = _find_user(body.get("auth") or {})
    if not user or not user.get("canDelete"):
        return jsonify({"ok": False, "error": "Access denied"}), 403

    message_id = body.get("messageId")
    _messages[:] = [m for m in _messages if m.get("id") != message_id]
    return jsonify({"ok": True})
