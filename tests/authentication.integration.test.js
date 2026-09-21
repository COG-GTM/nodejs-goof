var tap = require('tap');
var testApp = require('./helpers/test-app');
var httpClient = require('./helpers/client');

var VALID_USER = { username: 'admin@snyk.io', password: 'SuperSecretPassword' };

function withClient(callback) {
  testApp.seedUsers([VALID_USER]);
  var app = testApp.createApp();
  var server;
  return httpClient.startServer(app)
    .then(function (started) {
      server = started;
      return callback(httpClient.createClient(server));
    })
    .then(function () {
      return httpClient.stopServer(server);
    }, function (err) {
      return httpClient.stopServer(server).then(function () {
        throw err;
      });
    });
}

tap.test('POST /login with valid credentials redirects to /admin and sets a session', function (t) {
  return withClient(function (client) {
    return client.postForm('/login', VALID_USER).then(function (res) {
      t.equal(res.status, 302);
      t.equal(res.headers.get('location'), '/admin');
      t.ok(client.hasCookie(), 'session cookie is set');
      return client.get('/admin').then(function (adminRes) {
        t.equal(adminRes.status, 200, 'session grants access to /admin');
      });
    });
  });
});

tap.test('POST /login honours a caller supplied redirectPage', function (t) {
  return withClient(function (client) {
    var body = Object.assign({ redirectPage: 'https://example.com/' }, VALID_USER);
    return client.postForm('/login', body).then(function (res) {
      t.equal(res.status, 302);
      // Documents the current (open redirect) behaviour of adminLoginSuccess.
      t.equal(res.headers.get('location'), 'https://example.com/');
    });
  });
});

tap.test('POST /login with a wrong password is rejected', function (t) {
  return withClient(function (client) {
    return client.postForm('/login', {
      username: VALID_USER.username,
      password: 'wrong',
    }).then(function (res) {
      t.equal(res.status, 401);
      return client.get('/admin').then(function (adminRes) {
        t.equal(adminRes.status, 302);
        t.equal(adminRes.headers.get('location'), '/', 'no session was established');
      });
    });
  });
});

tap.test('POST /login with a non-email username is rejected', function (t) {
  return withClient(function (client) {
    return client.postForm('/login', {
      username: 'not-an-email',
      password: VALID_USER.password,
    }).then(function (res) {
      t.equal(res.status, 401);
    });
  });
});

tap.test('isLoggedIn redirects anonymous requests away from protected pages', function (t) {
  return withClient(function (client) {
    return Promise.all([
      client.get('/admin'),
      client.get('/account_details'),
    ]).then(function (responses) {
      responses.forEach(function (res) {
        t.equal(res.status, 302);
        t.equal(res.headers.get('location'), '/');
      });
    });
  });
});

tap.test('isLoggedIn allows protected pages once logged in', function (t) {
  return withClient(function (client) {
    return client.postForm('/login', VALID_USER).then(function () {
      return Promise.all([
        client.get('/admin'),
        client.get('/account_details'),
      ]).then(function (responses) {
        responses.forEach(function (res) {
          t.equal(res.status, 200);
        });
      });
    });
  });
});

tap.test('GET /logout ends the session and redirects home', function (t) {
  return withClient(function (client) {
    return client.postForm('/login', VALID_USER).then(function () {
      return client.get('/logout');
    }).then(function (res) {
      t.equal(res.status, 302);
      t.equal(res.headers.get('location'), '/');
      return client.get('/admin');
    }).then(function (res) {
      t.equal(res.status, 302);
      t.equal(res.headers.get('location'), '/', 'protected pages are locked again');
    });
  });
});
