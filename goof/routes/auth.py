"""Authentication and account routes (port of routes/index.js auth handlers)."""
import re
from functools import wraps

from flask import Blueprint, redirect, render_template, request, session

from ..db import mongo

bp = Blueprint("auth", __name__)

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_PHONE_IL_RE = re.compile(r"^(\+?972|0)(\-)?0?(([23489]{1}\d{7})|[5]{1}\d{8})$")


def _is_email(value, allow_display_name=False):
    if not isinstance(value, str):
        return False
    candidate = value
    if allow_display_name:
        match = re.search(r"<([^>]+)>\s*$", value)
        if match:
            candidate = match.group(1).strip()
    return bool(_EMAIL_RE.match(candidate))


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if session.get("loggedIn") == 1:
            return view(*args, **kwargs)
        return redirect("/")

    return wrapped


@bp.route("/login", methods=["GET"])
def login():
    return render_template(
        "admin.html",
        title="Admin Access",
        granted=False,
        redirectPage=request.args.get("redirectPage"),
    )


@bp.route("/login", methods=["POST"])
def login_handler():
    # Accept both JSON and form bodies (mirrors Express bodyParser.json +
    # urlencoded) so the documented JSON-based NoSQL injection exploit works.
    body = request.get_json(silent=True) or request.form.to_dict()
    username = body.get("username")
    password = body.get("password")
    if _is_email(username):
        # NOTE: intentional NoSQL injection (goof) - query built from raw input
        users = list(mongo.users().find({"username": username, "password": password}))
        if len(users) > 0:
            return _admin_login_success(body.get("redirectPage"), username)
        return ("", 401)
    return ("", 401)


def _admin_login_success(redirect_page, username):
    session["loggedIn"] = 1
    # Log the login action for audit
    print(f"User logged in: {username}")
    # NOTE: intentional open redirect (goof)
    if redirect_page:
        return redirect(redirect_page)
    return redirect("/admin")


@bp.route("/admin")
@login_required
def admin():
    return render_template("admin.html", title="Admin Access Granted", granted=True)


@bp.route("/account_details", methods=["GET"])
@login_required
def get_account_details():
    # @TODO need to add a database call to get the profile from the database
    return render_template("account.html")


@bp.route("/account_details", methods=["POST"])
@login_required
def save_account_details():
    # Accept JSON or form bodies (mirrors Express req.body handling).
    profile = request.get_json(silent=True) or request.form.to_dict()
    if (
        _is_email(profile.get("email", ""), allow_display_name=True)
        and bool(_PHONE_IL_RE.match(profile.get("phone", "")))
        and profile.get("firstname", "").isascii()
        and profile.get("lastname", "").isascii()
        and profile.get("country", "").isascii()
    ):
        profile["firstname"] = profile.get("firstname", "").rstrip()
        profile["lastname"] = profile.get("lastname", "").rstrip()
        return render_template("account.html", **profile)
    print("error in form details")
    return render_template("account.html")


@bp.route("/logout")
def logout():
    session["loggedIn"] = 0
    session.clear()
    return redirect("/")
