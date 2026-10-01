"""
Flask entrypoint for the (deliberately vulnerable) Goof TODO app.

This is the Python/Flask port of the original Node.js/Express Snyk "goof"
demo application. It is a SECURITY EDUCATION tool: the intentional
vulnerabilities and hardcoded credentials are preserved on purpose. DO NOT
deploy this to production or any public network.
"""
import os
import time

import markdown as markdown_lib
from flask import Flask

from routes import main_bp
from routes.users import users_bp


def create_app():
    # Serve the legacy ``public/`` assets under /public (the original app used
    # the ``st`` static middleware mounted at /public).
    app = Flask(__name__, static_folder="public", static_url_path="/public")

    # INTENTIONAL weak secret, matching the legacy "keyboard cat" session key.
    app.secret_key = "keyboard cat"

    # Markdown rendering filter used by the todo templates (the original app
    # exposed ``marked`` to the views).
    app.jinja_env.filters["markdown"] = lambda text: markdown_lib.markdown(text or "")

    app.register_blueprint(main_bp)
    app.register_blueprint(users_bp)

    return app


app = create_app()


def _init_databases():
    """Initialize MongoDB and MySQL, retrying while the containers come up.

    Imported lazily so that simply importing ``app`` (e.g. from the test
    suite) never triggers a blocking database connection.
    """
    from models.mongo import init_mongo
    from models.mysql import init_mysql

    for label, init in (("MongoDB", init_mongo), ("MySQL", init_mysql)):
        for attempt in range(1, 31):
            try:
                init()
                print(label + " ready")
                break
            except Exception as exc:  # noqa: BLE001 - best-effort startup wait
                print(
                    "Waiting for {label} (attempt {n}): {err}".format(
                        label=label, n=attempt, err=exc
                    )
                )
                time.sleep(2)


if __name__ == "__main__":
    token = "SECRET_TOKEN_f8ed84e8f41e4146403dd4a6bbcea5e418d23a9"
    print("token: " + token)

    _init_databases()

    port = int(os.environ.get("PORT", 3001))
    print("Flask server listening on port " + str(port))
    app.run(host="0.0.0.0", port=port)
