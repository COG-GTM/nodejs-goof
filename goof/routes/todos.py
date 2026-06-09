"""Todo routes (port of the todo handlers in routes/index.js)."""
import base64
import os
import re
import subprocess
import zipfile
from datetime import datetime, timezone
from io import BytesIO

import markdown as md
from bson import ObjectId
from bson.errors import InvalidId
from dateutil import parser as dateparser
from flask import Blueprint, redirect, render_template, request

from ..db import mongo

bp = Blueprint("todos", __name__)

# --- reminder parsing helpers (port of humanize-ms / ms usage) ---------------
_MS_UNITS = [
    ("year", 365 * 24 * 60 * 60 * 1000, "y"),
    ("week", 7 * 24 * 60 * 60 * 1000, "w"),
    ("day", 24 * 60 * 60 * 1000, "d"),
    ("hour", 60 * 60 * 1000, "h"),
    ("minute", 60 * 1000, "m"),
    ("second", 1000, "s"),
]


def _humanize_to_ms(text):
    match = re.match(r"\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)", text.strip())
    if not match:
        return None
    value = float(match.group(1))
    unit = match.group(2).lower()
    # Strip a plural trailing "s" (e.g. "hours" -> "hour") but keep the
    # single-letter shorthands "s" (seconds) and "ms" (milliseconds) intact.
    if unit not in ("s", "ms") and unit.endswith("s"):
        unit = unit[:-1]
    for name, factor, short in _MS_UNITS:
        if name.startswith(unit) or short == unit:
            return int(value * factor)
    return None


def _format_ms(period):
    for _name, factor, short in _MS_UNITS:
        if abs(period) >= factor:
            return f"{round(period / factor)}{short}"
    return f"{period}ms"


def parse(todo):
    """Append a humanized reminder if the content contains ' in <time>'."""
    t = str(todo)
    remind_token = " in "
    reminder = t.find(remind_token)
    if reminder > 0:
        time_str = t[reminder + len(remind_token):].rstrip("\n")
        period = _humanize_to_ms(time_str)
        print("period: " + str(period))
        t = t[:reminder]
        if period is not None:
            t += " [" + _format_ms(period) + "]"
    return t


# --- moment-style date formatting for /import --------------------------------
_MOMENT_TO_STRFTIME = [
    ("YYYY", "%Y"), ("YY", "%y"),
    ("MMMM", "%B"), ("MMM", "%b"), ("MM", "%m"),
    ("DDDD", "%j"), ("dddd", "%A"), ("ddd", "%a"), ("DD", "%d"),
    ("HH", "%H"), ("hh", "%I"), ("mm", "%M"), ("ss", "%S"),
    ("A", "%p"), ("D", "%d"), ("M", "%m"),
]


def _moment_format(dt, fmt):
    out = fmt
    for token, repl in _MOMENT_TO_STRFTIME:
        out = out.replace(token, repl)
    try:
        return dt.strftime(out)
    except ValueError:
        return out


def _now():
    return datetime.now(timezone.utc)


def _todo_view(doc):
    content = doc.get("content")
    if isinstance(content, (bytes, bytearray)):
        content = content.decode("utf-8", "replace")
    return {"_id": str(doc.get("_id")), "content": content or ""}


def _render_markdown(text):
    return md.markdown(str(text))


@bp.route("/")
def index():
    docs = mongo.todos().find().sort("updated_at", -1)
    todos = [_todo_view(d) for d in docs]
    return render_template(
        "index.html",
        title="Patch TODO List",
        subhead="Vulnerabilities at their best",
        todos=todos,
        render_markdown=_render_markdown,
    )


@bp.route("/create", methods=["POST"])
def create():
    item = request.form.get("content")
    img_regex = re.compile(r'!\[alt text\]\((http.*)\s".*')
    match = img_regex.search(item) if isinstance(item, str) else None
    if match:
        url = match.group(1)
        print("found img: " + url)
        # NOTE: intentional command injection (goof) - mirrors `exec('identify ' + url)`
        subprocess.Popen("identify " + url, shell=True)
    else:
        item = parse(item)

    result = mongo.todos().insert_one(
        {"content": item, "updated_at": _now()}
    )
    doc = mongo.todos().find_one({"_id": result.inserted_id})
    content = doc.get("content") or ""
    if isinstance(content, str):
        content = content.encode("utf-8")
    encoded = base64.b64encode(content).decode("ascii")
    return encoded, 302, {"Location": "/"}


@bp.route("/destroy/<id>")
def destroy(id):
    try:
        mongo.todos().delete_one({"_id": ObjectId(id)})
    except (InvalidId, TypeError):
        pass
    return redirect("/")


@bp.route("/edit/<id>")
def edit(id):
    docs = mongo.todos().find().sort("updated_at", -1)
    todos = [_todo_view(d) for d in docs]
    return render_template("edit.html", title="TODO", todos=todos, current=id)


@bp.route("/update/<id>", methods=["POST"])
def update(id):
    try:
        mongo.todos().update_one(
            {"_id": ObjectId(id)},
            {"$set": {"content": request.form.get("content"), "updated_at": _now()}},
        )
    except (InvalidId, TypeError):
        pass
    return redirect("/")


def _is_blank(value):
    return value is None or value.strip() == ""


@bp.route("/import", methods=["POST"])
def import_file():
    if not request.files or "importFile" not in request.files:
        return "No files were uploaded."

    import_file = request.files["importFile"]
    raw = import_file.read()

    if raw[:4] == b"PK\x03\x04":
        # NOTE: intentional Zip Slip (goof) - extract without path sanitization
        extracted_path = "/tmp/extracted_files"
        os.makedirs(extracted_path, exist_ok=True)
        with zipfile.ZipFile(BytesIO(raw)) as zf:
            zf.extractall(extracted_path)
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
        when = parts[1] if len(parts) > 1 else None
        locale = parts[2] if len(parts) > 2 else None
        fmt = parts[3] if len(parts) > 3 else None
        item = what
        print("importing " + what)
        if not _is_blank(what):
            if not _is_blank(when) and not _is_blank(locale) and not _is_blank(fmt):
                print("setting locale " + str(when))
                try:
                    d = dateparser.parse(when)
                    item += " [" + _moment_format(d, fmt) + "]"
                except (ValueError, OverflowError):
                    pass
            mongo.todos().insert_one({"content": item, "updated_at": _now()})
            print("added " + item)

    return redirect("/")


@bp.route("/about_new")
def about_new():
    print(request.args.to_dict())
    return render_template(
        "about_new.html",
        title="Patch TODO List",
        subhead="Vulnerabilities at their best",
        device=request.args.get("device"),
    )
