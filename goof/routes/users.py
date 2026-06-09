"""Users REST routes backed by MySQL (port of routes/users.js)."""
from flask import Blueprint, jsonify, request

from ..db import mysql

bp = Blueprint("users", __name__, url_prefix="/users")


@bp.route("/", methods=["GET"])
def list_users():
    session = mysql.get_session()
    try:
        # Hard-coded getting account id of 1 (matches the original demo).
        results = session.query(mysql.Users).filter(mysql.Users.id == 1).all()
        payload = [
            {"id": u.id, "name": u.name, "address": u.address, "role": u.role}
            for u in results
        ]
        print(payload)
        return jsonify(payload)
    finally:
        session.close()


@bp.route("/", methods=["POST"])
def create_user():
    session = mysql.get_session()
    try:
        body = request.get_json(silent=True) or request.form.to_dict()
        user = mysql.Users(
            name=body.get("name"),
            address=body.get("address"),
            role=body.get("role"),
        )
        session.add(user)
        session.commit()
        print("Post has been saved: ", user.id)
        return ("", 200)
    except Exception as err:  # noqa: BLE001 - mirror original loose error handling
        session.rollback()
        print(err)
        return ("", 500)
    finally:
        session.close()
