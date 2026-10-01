"""Port of routes/users.js — MySQL-backed users endpoints."""

from flask import Blueprint, jsonify

from db.mysql import SessionLocal, Users
from routes.main import get_body

users_bp = Blueprint("users", __name__)


@users_bp.route("/", methods=["GET"])
def list_users():
    session = SessionLocal()
    try:
        # hard-coded getting account id of 1, as a replacement to getting this
        # from the session and such (just imagine that we implemented auth, etc)
        results = session.query(Users).filter(Users.id == 1).all()
        print(results)
        return jsonify([u.as_dict() for u in results])
    finally:
        session.close()


@users_bp.route("/", methods=["POST"])
def create_user():
    body = get_body()
    session = SessionLocal()
    try:
        user = Users(
            name=body.get("name"),
            address=body.get("address"),
            role=body.get("role"),
        )
        session.add(user)
        session.commit()
        print("Post has been saved: ", user.as_dict())
        return ("OK", 200)
    except Exception as err:
        session.rollback()
        print(err)
        return ("", 500)
    finally:
        session.close()
