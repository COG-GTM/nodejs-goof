// Integration tests for the HTTP surface declared in app.js.
//
// Two layers:
//  - the route table itself (which handlers, and which guards, are wired to
//    each method + path), so dropping isLoggedIn from a protected route fails;
//  - live HTTP requests against the app for the routes that do not need a
//    database, covering both the allowed and the denied path of every guard.

var nodeTest = require('node:test');
var test = nodeTest.test;
var describe = nodeTest.describe;
var it = nodeTest.it;
var before = nodeTest.before;
var after = nodeTest.after;
var assert = require('node:assert');
var mongoose = require('mongoose');

var app = require('../app');
var routes = require('../routes');
var httpClient = require('./helpers/http-client');

// Reverse lookup so failures name the handler instead of printing a function.
var handlerNames = new Map();
Object.keys(routes).forEach(function (name) {
  if (typeof routes[name] === 'function') handlerNames.set(routes[name], name);
});
Object.keys(routes.chat).forEach(function (name) {
  handlerNames.set(routes.chat[name], 'chat.' + name);
});

function routeTable() {
  return app._router.stack
    .filter(function (layer) { return layer.route; })
    .map(function (layer) {
      var method = Object.keys(layer.route.methods)[0].toUpperCase();
      return {
        route: method + ' ' + layer.route.path,
        handlers: layer.route.stack.map(function (entry) {
          return handlerNames.get(entry.handle) || entry.handle.name || '<anonymous>';
        })
      };
    });
}

test('route table wires the expected handlers and guards', function () {
  assert.deepStrictEqual(routeTable(), [
    { route: 'GET /', handlers: ['index'] },
    { route: 'GET /login', handlers: ['login'] },
    { route: 'POST /login', handlers: ['loginHandler'] },
    { route: 'GET /admin', handlers: ['isLoggedIn', 'admin'] },
    { route: 'GET /account_details', handlers: ['isLoggedIn', 'get_account_details'] },
    { route: 'POST /account_details', handlers: ['isLoggedIn', 'save_account_details'] },
    { route: 'GET /logout', handlers: ['logout'] },
    { route: 'POST /create', handlers: ['create'] },
    { route: 'GET /destroy/:id', handlers: ['destroy'] },
    { route: 'GET /edit/:id', handlers: ['edit'] },
    { route: 'POST /update/:id', handlers: ['update'] },
    { route: 'POST /import', handlers: ['import'] },
    { route: 'GET /about_new', handlers: ['about_new'] },
    { route: 'GET /chat', handlers: ['chat.get'] },
    { route: 'PUT /chat', handlers: ['chat.add'] },
    { route: 'DELETE /chat', handlers: ['chat.delete'] }
  ]);
});

test('isLoggedIn lets a logged in session through', function () {
  var nextCalled = false;
  routes.isLoggedIn({ session: { loggedIn: 1 } }, {}, function () { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
});

test('isLoggedIn redirects anyone else to /', function () {
  var redirectedTo = null;
  var res = { redirect: function (target) { redirectedTo = target; } };
  routes.isLoggedIn({ session: {} }, res, function () {
    assert.fail('guard called next() for an anonymous session');
  });
  assert.strictEqual(redirectedTo, '/');
});

describe('HTTP surface', function () {
  var client;
  var server;

  // Logs in over the real POST /login route with the user lookup stubbed, so
  // the guarded routes are exercised without a live MongoDB.
  async function login(t) {
    var User = mongoose.model('User');
    t.mock.method(User, 'find', function (query, callback) {
      callback(null, [{ username: query.username, password: query.password }]);
    });

    var loggedIn = httpClient.createClient(server.address().port);
    var res = await loggedIn.post('/login', {
      form: { username: 'admin@snyk.io', password: 'SuperSecretPassword' }
    });
    assert.strictEqual(res.status, 302);
    assert.strictEqual(res.headers.location, '/admin');
    return loggedIn;
  }

  before(function () {
    return new Promise(function (resolve) {
      httpClient.startServer(app, function (c, s) {
        client = c;
        server = s;
        resolve();
      });
    });
  });

  after(function () {
    server.close();
    return mongoose.disconnect();
  });

  it('GET /login renders the login form', async function () {
    var res = await client.get('/login');
    assert.strictEqual(res.status, 200);
    assert.match(res.text, /Admin Access/);
  });

  it('POST /login rejects a non-email username', async function () {
    var res = await client.post('/login', {
      form: { username: 'not-an-email', password: 'SuperSecretPassword' }
    });
    assert.strictEqual(res.status, 401);
  });

  it('guarded routes redirect an anonymous visitor to /', async function () {
    var responses = await Promise.all([
      client.get('/admin'),
      client.get('/account_details'),
      client.post('/account_details', { form: { email: 'admin@snyk.io' } })
    ]);
    responses.forEach(function (res) {
      assert.strictEqual(res.status, 302);
      assert.strictEqual(res.headers.location, '/');
    });
  });

  it('guarded routes serve a logged in session', async function (t) {
    var loggedIn = await login(t);

    var admin = await loggedIn.get('/admin');
    assert.strictEqual(admin.status, 200);
    assert.match(admin.text, /Admin Access Granted/);

    var details = await loggedIn.get('/account_details');
    assert.strictEqual(details.status, 200);

    var saved = await loggedIn.post('/account_details', {
      form: {
        email: 'admin@snyk.io',
        phone: '0541234567',
        firstname: 'Ad',
        lastname: 'Min',
        country: 'IL'
      }
    });
    assert.strictEqual(saved.status, 200);
    assert.match(saved.text, /Ad/);

    var loggedOut = await loggedIn.get('/logout');
    assert.strictEqual(loggedOut.status, 302);

    var afterLogout = await loggedIn.get('/admin');
    assert.strictEqual(afterLogout.status, 302, 'logout drops the session');
    assert.strictEqual(afterLogout.headers.location, '/');
  });

  it('GET /about_new renders without authentication', async function () {
    var res = await client.get('/about_new?device=phone');
    assert.strictEqual(res.status, 200);
  });

  it('chat routes enforce their own body based auth', async function () {
    var empty = await client.get('/chat');
    assert.strictEqual(empty.status, 200);
    assert.ok(Array.isArray(empty.json()));

    var denied = await client.put('/chat', { json: { message: { text: 'hi' } } });
    assert.strictEqual(denied.status, 403);

    var added = await client.put('/chat', {
      json: { auth: { name: 'user', password: 'pwd' }, message: { text: 'hi' } }
    });
    assert.strictEqual(added.status, 200);
    assert.deepStrictEqual(added.json(), { ok: true });

    var messages = await client.get('/chat');
    assert.strictEqual(messages.json().length, 1);

    var deleted = await client.delete('/chat', {
      json: { auth: { name: 'user', password: 'pwd' }, messageId: 1 }
    });
    assert.strictEqual(deleted.status, 403, 'a user without canDelete cannot delete');
  });
});

