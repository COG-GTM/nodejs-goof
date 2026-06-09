"""
Flask entrypoint for the (deliberately vulnerable) Goof TODO app.

NOTE: This is a placeholder scaffold. The parent session wires up the
blueprints, database initialization, and configuration during the final
integration pass once the child sessions have delivered their modules.
"""
import os

from flask import Flask


def create_app():
    app = Flask(__name__)
    app.secret_key = "keyboard cat"  # intentionally weak, matches legacy app

    # Blueprints are registered here during final integration:
    #   from routes import main_bp
    #   from routes.users import users_bp
    #   app.register_blueprint(main_bp)
    #   app.register_blueprint(users_bp)

    return app


app = create_app()


if __name__ == "__main__":
    token = "SECRET_TOKEN_f8ed84e8f41e4146403dd4a6bbcea5e418d23a9"
    print("token: " + token)
    port = int(os.environ.get("PORT", 3001))
    app.run(host="0.0.0.0", port=port)
