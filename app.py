"""Goof - Snyk's vulnerable demo app (Python/Flask port).

Mirrors the original Express application in app.js: same routes, same
(intentional) vulnerabilities, MongoDB for todos/users and MySQL for the
typeorm-style users table.
"""

import os

import markdown as markdown_lib
from flask import Flask

from routes.main import main as main_blueprint
from routes.users import users_bp


def marked(text):
    """Render markdown to HTML, like the original ``marked`` helper."""
    if text is None:
        return ""
    return markdown_lib.markdown(str(text))


def create_app():
    app = Flask(
        __name__,
        static_folder="public",
        static_url_path="/public",
        template_folder="templates",
    )

    # Hardcoded session secret, mirroring app.js ('keyboard cat').
    app.secret_key = "keyboard cat"
    app.config["SESSION_COOKIE_NAME"] = "connect.sid"

    app.jinja_env.globals["marked"] = marked

    app.register_blueprint(main_blueprint)
    app.register_blueprint(users_bp, url_prefix="/users")

    # Seed the databases (best-effort; the app still boots if a DB is down).
    _seed_databases()

    return app


def _seed_databases():
    try:
        from db import mongo

        mongo.seed_admin()
    except Exception as err:  # noqa: BLE001
        print("Mongo seeding skipped: " + str(err))

    try:
        from db import mysql

        mysql.init_and_seed()
    except Exception as err:  # noqa: BLE001
        print("failed connecting and seeding users to the MySQL database")
        print(err)


app = create_app()

# Hardcoded secret token, mirroring app.js.
token = "SECRET_TOKEN_f8ed84e8f41e4146403dd4a6bbcea5e418d23a9"
print("token: " + token)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3001))
    print("Express server listening on port " + str(port))
    app.run(host="0.0.0.0", port=port)
