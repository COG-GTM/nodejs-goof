"""Flask blueprint port of the original Express ``routes/index.js``.

This is part of the deliberately vulnerable Snyk "goof" demo app. The
intentional vulnerabilities (NoSQL injection, open redirect, command
injection, zip slip, SSTI, prototype-pollution analogue) are PRESERVED on
purpose for security education. Do NOT add sanitization/validation/escaping.
"""
import base64
import datetime
import functools
import io
import os
import re
import zipfile

from bson import ObjectId
from flask import (
    Blueprint,
    jsonify,
    make_response,
    redirect,
    render_template,
    render_template_string,
    request,
    session,
)

from models.mongo import todos, users

main_bp = Blueprint('main', __name__)


def login_required(view):
    """Mirror of the original ``isLoggedIn`` middleware."""

    @functools.wraps(view)
    def wrapped(*args, **kwargs):
        if session.get('loggedIn') == 1:
            return view(*args, **kwargs)
        return redirect('/')

    return wrapped


def parse(todo):
    """Loose port of the original reminder ``parse`` helper."""
    t = str(todo)
    remind_token = ' in '
    reminder = t.find(remind_token)
    if reminder > 0:
        time = t[reminder + len(remind_token):]
        time = time.rstrip('\n')
        t = t[:reminder]
        if time:
            t += ' [' + time + ']'
    return t


def is_blank(value):
    return not value or re.match(r'^\s*$', value) is not None


@main_bp.route('/', methods=['GET'])
def index():
    todos_list = list(todos.find({}).sort('updated_at', -1))
    return render_template(
        'index.html',
        title='Patch TODO List',
        subhead='Vulnerabilities at their best',
        todos=todos_list,
    )


@main_bp.route('/login', methods=['GET'])
def login():
    return render_template(
        'admin.html',
        title='Admin Access',
        granted=False,
        redirectPage=request.args.get('redirectPage'),
    )


@main_bp.route('/login', methods=['POST'])
def login_handler():
    body = request.get_json(force=True, silent=True) or {}

    # NoSQL INJECTION (intentional): the raw, unsanitized request body is
    # passed straight into the Mongo query, allowing operator injection such
    # as {"username": {"$gt": ""}, "password": {"$gt": ""}}.
    user = users.find_one({
        'username': body.get('username'),
        'password': body.get('password'),
    })

    if user:
        session['loggedIn'] = 1
        username = body.get('username')
        print('User logged in: ' + str(username))

        # OPEN REDIRECT (intentional): redirect target taken from user input
        # with no validation.
        redirect_page = body.get('redirectPage')
        if redirect_page:
            return redirect(redirect_page)
        return redirect('/admin')

    return ('', 401)


@main_bp.route('/admin', methods=['GET'])
@login_required
def admin():
    return render_template('admin.html', title='Admin Access Granted', granted=True)


@main_bp.route('/account_details', methods=['GET'])
@login_required
def get_account_details():
    return render_template('account.html')


@main_bp.route('/account_details', methods=['POST'])
@login_required
def save_account_details():
    # Loose handling that mirrors the original save_account_details: the
    # submitted profile is rendered back as-is without strict validation.
    profile = request.get_json(force=True, silent=True) or request.form.to_dict()
    return render_template('account.html', **profile)


@main_bp.route('/logout', methods=['GET'])
def logout():
    session['loggedIn'] = 0
    session.clear()
    return redirect('/')


@main_bp.route('/create', methods=['POST'])
def create():
    item = request.form.get('content')
    if item is None:
        body = request.get_json(force=True, silent=True) or {}
        item = body.get('content')

    img_regex = r'\!\[alt text\]\((http.*)\s\".*'
    if isinstance(item, str) and re.match(img_regex, item):
        url = re.match(img_regex, item).group(1)
        print('found img: ' + url)

        # COMMAND INJECTION (intentional): the extracted URL is concatenated
        # into a shell command with no escaping.
        os.system('identify ' + url)
    else:
        item = parse(item)

    todos.insert_one({
        'content': item,
        'updated_at': datetime.datetime.utcnow(),
    })

    content_b64 = base64.b64encode(str(item).encode()).decode()
    resp = make_response(content_b64, 302)
    resp.headers['Location'] = '/'
    return resp


@main_bp.route('/destroy/<id>', methods=['GET'])
def destroy(id):
    try:
        todos.delete_one({'_id': ObjectId(id)})
    except Exception:
        pass
    return redirect('/')


@main_bp.route('/edit/<id>', methods=['GET'])
def edit(id):
    todos_list = list(todos.find({}).sort('updated_at', -1))
    return render_template(
        'edit.html',
        title='TODO',
        todos=todos_list,
        current=id,
    )


@main_bp.route('/update/<id>', methods=['POST'])
def update(id):
    content = request.form.get('content')
    if content is None:
        body = request.get_json(force=True, silent=True) or {}
        content = body.get('content')

    todos.update_one(
        {'_id': ObjectId(id)},
        {'$set': {'content': content, 'updated_at': datetime.datetime.utcnow()}},
    )
    return redirect('/')


@main_bp.route('/import', methods=['POST'])
def import_todos():
    if not request.files or 'importFile' not in request.files:
        return 'No files were uploaded.'

    import_file = request.files['importFile']
    file_bytes = import_file.read()

    data = ''
    if zipfile.is_zipfile(io.BytesIO(file_bytes)):
        # ZIP SLIP (intentional): archive entries are extracted with no path
        # validation, allowing writes outside the target directory.
        extracted_path = '/tmp/extracted_files'
        zipfile.ZipFile(io.BytesIO(file_bytes)).extractall(extracted_path)
        data = 'No backup.txt file found'
        try:
            with open('backup.txt', 'r') as f:
                data = f.read()
        except OSError:
            pass
    else:
        data = file_bytes.decode('ascii', errors='replace')

    lines = data.split('\n')
    for line in lines:
        parts = line.split(',')
        what = parts[0]
        print('importing ' + what)
        when = parts[1] if len(parts) > 1 else None
        locale = parts[2] if len(parts) > 2 else None
        fmt = parts[3] if len(parts) > 3 else None
        item = what
        if not is_blank(what):
            if not is_blank(when) and not is_blank(locale) and not is_blank(fmt):
                item += ' [' + str(when) + ']'

            todos.insert_one({
                'content': item,
                'updated_at': datetime.datetime.utcnow(),
            })

    return redirect('/')


@main_bp.route('/about_new', methods=['GET'])
def about_new():
    # SSTI (intentional): the unsanitized ``device`` query parameter is
    # concatenated directly into the template source and rendered, allowing
    # server-side template injection (e.g. ?device={{7*7}}).
    device = request.args.get('device')
    template = (
        '<h1>Patch TODO List</h1>'
        '<h2>Vulnerabilities at their best</h2>'
        '<p>Device: ' + str(device) + '</p>'
    )
    return render_template_string(template)


# ---------------------------------------------------------------------------
# Chat endpoints with a prototype-pollution analogue.
#
# In order of simplicity we are not using any database for chat. Hardcoded
# users below are INTENTIONAL (security demo).
# ---------------------------------------------------------------------------
users_chat = [
    # You know the password for the user.
    {"name": "user", "password": "pwd"},
    # You don't know the password for the admin.
    {"name": "admin", "password": os.urandom(16).hex(), "canDelete": True},
]

messages = []
_state = {'last_id': 1}


def find_user(auth):
    auth = auth or {}
    for u in users_chat:
        if u.get('name') == auth.get('name') and u.get('password') == auth.get('password'):
            return u
    return None


def deep_merge(target, source):
    """Recursive merge that does NOT filter dangerous keys.

    This is the Python analogue of the original ``lodash.merge`` prototype
    pollution: keys such as ``__class__`` / ``__proto__`` / ``__init__`` are
    merged through without any filtering (intentional vulnerability).
    """
    for key in source:
        value = source[key]
        if isinstance(value, dict) and isinstance(target.get(key), dict):
            deep_merge(target[key], value)
        else:
            target[key] = value
    return target


@main_bp.route('/chat', methods=['GET'])
def chat_get():
    return jsonify(messages)


@main_bp.route('/chat', methods=['PUT'])
def chat_add():
    body = request.get_json(force=True, silent=True) or {}
    user = find_user(body.get('auth') or {})

    if not user:
        return jsonify({'ok': False, 'error': 'Access denied'}), 403

    message = {
        # Default message icon. Can be overwritten by user.
        'icon': '\U0001f44b',
    }

    deep_merge(message, body.get('message') or {})
    deep_merge(message, {
        'id': _state['last_id'],
        'timestamp': int(datetime.datetime.utcnow().timestamp() * 1000),
        'userName': user['name'],
    })
    _state['last_id'] += 1

    messages.append(message)
    return jsonify({'ok': True})


@main_bp.route('/chat', methods=['DELETE'])
def chat_delete():
    global messages
    body = request.get_json(force=True, silent=True) or {}
    user = find_user(body.get('auth') or {})

    if not user or not user.get('canDelete'):
        return jsonify({'ok': False, 'error': 'Access denied'}), 403

    messages = [m for m in messages if m.get('id') != body.get('messageId')]
    return jsonify({'ok': True})
