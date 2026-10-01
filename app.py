"""Application entrypoint (Python port of app.js)."""
import os

from flask import Flask

from goof.db import mongo, mysql
from goof.routes import auth, chat, todos, users


def create_app():
    app = Flask(
        __name__,
        static_folder="public",
        static_url_path="/public",
        template_folder="templates",
    )
    # NOTE: intentional hardcoded weak session secret (goof) - mirrors 'keyboard cat'
    app.secret_key = "keyboard cat"

    app.register_blueprint(todos.bp)
    app.register_blueprint(auth.bp)
    app.register_blueprint(chat.bp)
    app.register_blueprint(users.bp)

    # Initialize / seed datastores (tolerant of unavailable services).
    mongo.seed_admin()
    mysql.init_db()

    return app


# NOTE: intentional hardcoded secret token (goof)
token = "SECRET_TOKEN_f8ed84e8f41e4146403dd4a6bbcea5e418d23a9"
print("token: " + token)

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3001))
    print("Express server listening on port " + str(port))
    app.run(host="0.0.0.0", port=port)
