from flask import Blueprint, jsonify, request

from models.mysql import SessionLocal, Users

users_bp = Blueprint('users', __name__, url_prefix='/users')


@users_bp.route('/', methods=['GET'])
def get_users():
    session = SessionLocal()
    results = session.query(Users).all()

    users = []
    for user in results:
        users.append({
            'id': user.id,
            'name': user.name,
            'address': user.address,
            'role': user.role,
        })

    # Log for debug reasons, mirroring the legacy handler:
    print('users:', users)

    return jsonify(users)


@users_bp.route('/', methods=['POST'])
def create_user():
    try:
        session = SessionLocal()

        user = Users()
        user.name = request.json['name']
        user.address = request.json['address']
        user.role = request.json['role']

        session.add(user)
        session.commit()
        print('Post has been saved: ', user)
        return '', 200

    except Exception as err:
        print(err)
