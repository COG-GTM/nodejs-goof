"""Port of routes/index.js — todos, auth, account, import, chat."""

import base64
import os
import random
import re
import subprocess
import time
import zipfile

from bson import ObjectId
from bson.errors import InvalidId
from dateutil import parser as date_parser
from flask import (
    Blueprint,
    jsonify,
    redirect,
    render_template,
    render_template_string,
    request,
    session,
)

import ms_util
import validators
from db import mongo

main = Blueprint("main", __name__)

IMG_REGEX = re.compile(r"\!\[alt text\]\((http.*)\s\".*")


def get_body():
    """Merge JSON and form bodies, preferring JSON (like body-parser)."""
    body = {}
    form = request.form.to_dict()
    if form:
        body.update(form)
    json_body = request.get_json(silent=True)
    if isinstance(json_body, dict):
        body.update(json_body)
    return body


def _todo_to_dict(doc):
    content = doc.get("content", "")
    if isinstance(content, (bytes, bytearray)):
        content = content.decode("utf-8", "replace")
    return {"_id": str(doc.get("_id")), "content": content}


# ---------------------------------------------------------------------------
# Todos
# ---------------------------------------------------------------------------


@main.route("/", methods=["GET"])
def index():
    todos = [_todo_to_dict(t) for t in mongo.todos.find({}).sort("updated_at", -1)]
    return render_template(
        "index.html",
        title="Patch TODO List",
        subhead="Vulnerabilities at their best",
        todos=todos,
    )


def parse(todo):
    """Append a reminder marker, e.g. 'Walk the dog in 2 hours' -> '... [2h]'."""
    t = str(todo)
    remind_token = " in "
    reminder = t.find(remind_token)
    if reminder > 0:
        time = t[reminder + len(remind_token):]
        time = re.sub(r"\n$", "", time)
        period = ms_util.parse(time)
        print("period: " + str(period))
        t = t[:reminder]
        if period is not None:
            t += " [" + ms_util.format(period) + "]"
    return t


@main.route("/create", methods=["POST"])
def create():
    item = get_body().get("content")
    if isinstance(item, str) and IMG_REGEX.search(item):
        url = IMG_REGEX.search(item).group(1)
        print("found img: " + url)
        # Command injection: untrusted url flows into a shell command.
        subprocess.Popen(
            "identify " + url, shell=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
    else:
        item = parse(item)

    mongo.todos.insert_one({"content": item, "updated_at": _now_ms()})
    content_str = item if isinstance(item, str) else str(item)
    encoded = base64.b64encode(content_str.encode("utf-8")).decode("ascii")
    return (encoded, 302, {"Location": "/"})


@main.route("/destroy/<id>", methods=["GET"])
def destroy(id):
    try:
        mongo.todos.delete_one({"_id": ObjectId(id)})
    except InvalidId:
        pass
    return redirect("/")


@main.route("/edit/<id>", methods=["GET"])
def edit(id):
    todos = [_todo_to_dict(t) for t in mongo.todos.find({}).sort("updated_at", -1)]
    return render_template("edit.html", title="TODO", todos=todos, current=id)


@main.route("/update/<id>", methods=["POST"])
def update(id):
    content = get_body().get("content")
    mongo.todos.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"content": content, "updated_at": _now_ms()}},
    )
    return redirect("/")


# ---------------------------------------------------------------------------
# Auth / admin
# ---------------------------------------------------------------------------


@main.route("/login", methods=["GET"])
def login():
    return render_template(
        "admin.html",
        title="Admin Access",
        granted=False,
        redirectPage=request.args.get("redirectPage", ""),
    )


@main.route("/login", methods=["POST"])
def login_handler():
    body = get_body()
    username = body.get("username")
    if validators.is_email(username):
        # NoSQL injection: password (and username) are passed to the query as-is,
        # so an attacker can send {"$gt": ""} to bypass authentication.
        found = list(
            mongo.users.find(
                {"username": username, "password": body.get("password")}
            )
        )
        if len(found) > 0:
            return admin_login_success(
                body.get("redirectPage"), username
            )
        return ("", 401)
    return ("", 401)


def admin_login_success(redirect_page, username):
    session["loggedIn"] = 1
    print("User logged in: " + str(username))
    # Open redirect: redirect target is attacker-controlled and unvalidated.
    if redirect_page:
        return redirect(redirect_page)
    return redirect("/admin")


@main.route("/admin", methods=["GET"])
def admin():
    if not _is_logged_in():
        return redirect("/")
    return render_template("admin.html", title="Admin Access Granted", granted=True)


@main.route("/logout", methods=["GET"])
def logout():
    session["loggedIn"] = 0
    session.clear()
    return redirect("/")


def _is_logged_in():
    return session.get("loggedIn") == 1


# ---------------------------------------------------------------------------
# Account details (SSTI / template injection)
# ---------------------------------------------------------------------------

ACCOUNT_TEMPLATE = """
<style>
strong {font-weight: bold}
</style>
{% if firstname %}
    <h1 id="page-title">Account details for: __FIRSTNAME_RAW__</h1>
    <center>
        <h3 style="color: green">details saved</h3>
    </center>
{% else %}
    <h1 id="page-title" style="color: red">Account details missing</h1>
{% endif %}

<div id="list">
  <form action="/account_details" method="POST" accept-charset="utf-8">
    <div class="item-new">
      <center>First name</center>
      <input class="input" type="text" name="firstname" value="{{ firstname }}" />
      <br/>
     <center>Last name</center>
     <input class="input" type="text" name="lastname"  value="{{ lastname }}" />
     <br/>
     <center>Country</center>
     <input class="input" type="text" name="country" value="{{ country }}" />
     <br/>
     <center>Phone number</center>
     <input class="input" type="text" name="phone" value="{{ phone }}" />
     <br/>
     <center>Email</center>
     <input class="input" type="text" name="email" value="{{ email }}" />
     <br/>
    </div>
    <br/><br/>
     <button type="submit">Save account details</button>
  </form>
</div>
"""


def _render_account(profile):
    # The first name flows unescaped into the template source, mirroring the
    # original handlebars template injection vulnerability.
    template = ACCOUNT_TEMPLATE.replace(
        "__FIRSTNAME_RAW__", str(profile.get("firstname", ""))
    )
    return render_template_string(template, **profile)


@main.route("/account_details", methods=["GET"])
def get_account_details():
    if not _is_logged_in():
        return redirect("/")
    return _render_account({})


@main.route("/account_details", methods=["POST"])
def save_account_details():
    if not _is_logged_in():
        return redirect("/")
    profile = get_body()
    if (
        validators.is_email(profile.get("email", ""), allow_display_name=True)
        and validators.is_mobile_phone(profile.get("phone", ""), "he-IL")
        and validators.is_ascii(profile.get("firstname", ""))
        and validators.is_ascii(profile.get("lastname", ""))
        and validators.is_ascii(profile.get("country", ""))
    ):
        profile["firstname"] = validators.rtrim(profile.get("firstname", ""))
        profile["lastname"] = validators.rtrim(profile.get("lastname", ""))
        return _render_account(profile)
    print("error in form details")
    return _render_account({})


# ---------------------------------------------------------------------------
# Import (zip-slip)
# ---------------------------------------------------------------------------


def _is_blank(value):
    return not value or re.match(r"^\s*$", value) is not None


def _moment_format(when, fmt):
    try:
        parsed = date_parser.parse(when)
    except (ValueError, OverflowError):
        return when
    return _convert_moment_format(parsed, fmt)


_MOMENT_TOKENS = [
    ("YYYY", "%Y"), ("YY", "%y"), ("MMMM", "%B"), ("MMM", "%b"),
    ("MM", "%m"), ("DD", "%d"), ("dddd", "%A"), ("ddd", "%a"),
    ("HH", "%H"), ("mm", "%M"), ("ss", "%S"), ("D", "%d"), ("M", "%m"),
]


def _convert_moment_format(dt, fmt):
    out = fmt
    for token, directive in _MOMENT_TOKENS:
        out = out.replace(token, directive)
    try:
        return dt.strftime(out)
    except ValueError:
        return fmt


@main.route("/import", methods=["POST"])
def import_todos():
    if "importFile" not in request.files:
        return "No files were uploaded."

    import_file = request.files["importFile"]
    raw = import_file.read()

    data = None
    if raw[:4] == b"PK\x03\x04":
        extracted_path = "/tmp/extracted_files"
        os.makedirs(extracted_path, exist_ok=True)
        # Zip-slip: archive entry names are joined without sanitisation, so
        # entries like ../../foo escape the extraction directory.
        import_file.stream.seek(0)
        with zipfile.ZipFile(import_file.stream) as zf:
            for name in zf.namelist():
                target = os.path.join(extracted_path, name)
                if name.endswith("/"):
                    os.makedirs(target, exist_ok=True)
                    continue
                os.makedirs(os.path.dirname(target), exist_ok=True)
                with open(target, "wb") as fh:
                    fh.write(zf.read(name))
        data = "No backup.txt file found"
        try:
            with open("backup.txt", "r", encoding="ascii") as fh:
                data = fh.read()
        except OSError:
            pass
    else:
        data = raw.decode("ascii", "replace")

    for line in data.split("\n"):
        parts = line.split(",")
        what = parts[0] if len(parts) > 0 else ""
        print("importing " + what)
        when = parts[1] if len(parts) > 1 else ""
        locale = parts[2] if len(parts) > 2 else ""
        fmt = parts[3] if len(parts) > 3 else ""
        item = what
        if not _is_blank(what):
            if not _is_blank(when) and not _is_blank(locale) and not _is_blank(fmt):
                print("setting locale " + when)
                item += " [" + _moment_format(when, fmt) + "]"
            mongo.todos.insert_one({"content": item, "updated_at": _now_ms()})
            print("added " + item)

    return redirect("/")


# ---------------------------------------------------------------------------
# about_new (template injection via device query param)
# ---------------------------------------------------------------------------

ABOUT_NEW_TEMPLATE = """<!DOCTYPE html>
<html>
{% if "__DEVICE_RAW__" == "Desktop" %}
  <body style="font-size: medium; text-align: center;">
{% else %}
  <body style="font-size: x-large; text-align: center;">
{% endif %}
  <h1 id="page-title">{{ title }}</h1>
  <h2 id="page-title">{{ subhead }}</h2>
  <p>The BESTest todo app evar</p>
  <div style="position:absolute; bottom:0;">Device string (debug): __DEVICE_RAW__</div>
  </body>
</html>
"""


@main.route("/about_new", methods=["GET"])
def about_new():
    device = request.args.get("device", "")
    template = ABOUT_NEW_TEMPLATE.replace("__DEVICE_RAW__", str(device))
    return render_template_string(
        template,
        title="Patch TODO List",
        subhead="Vulnerabilities at their best",
    )


def _now_ms():
    return int(time.time() * 1000)


# ---------------------------------------------------------------------------
# Chat (mass assignment / prototype-pollution analog)
# ---------------------------------------------------------------------------

# In order of simplicity we are not using any database.
_users = [
    # You know password for the user.
    {"name": "user", "password": "pwd"},
    # You don't know password for the admin.
    {"name": "admin", "password": random.random().hex(), "canDelete": True},
]

_messages = []
_last_id = [1]


def _find_user(auth):
    for u in _users:
        if u["name"] == auth.get("name") and u["password"] == auth.get("password"):
            return u
    return None


def _deep_merge(target, source):
    """Recursive merge, mirroring lodash's vulnerable ``_.merge``."""
    if not isinstance(source, dict):
        return target
    for key, value in source.items():
        if isinstance(value, dict) and isinstance(target.get(key), dict):
            _deep_merge(target[key], value)
        else:
            target[key] = value
    return target


@main.route("/chat", methods=["GET"])
def chat_get():
    return jsonify(_messages)


@main.route("/chat", methods=["PUT"])
def chat_add():
    body = get_body()
    user = _find_user(body.get("auth") or {})
    if not user:
        return jsonify({"ok": False, "error": "Access denied"}), 403

    # Default message icon. Can be overwritten by user.
    message = {"icon": "\U0001f44b"}
    _deep_merge(message, body.get("message") or {})
    _deep_merge(
        message,
        {
            "id": _last_id[0],
            "timestamp": _now_ms(),
            "userName": user["name"],
        },
    )
    _last_id[0] += 1
    _messages.append(message)
    return jsonify({"ok": True})


@main.route("/chat", methods=["DELETE"])
def chat_delete():
    body = get_body()
    user = _find_user(body.get("auth") or {})
    if not user or not user.get("canDelete"):
        return jsonify({"ok": False, "error": "Access denied"}), 403

    message_id = body.get("messageId")
    global _messages
    _messages = [m for m in _messages if m.get("id") != message_id]
    return jsonify({"ok": True})
