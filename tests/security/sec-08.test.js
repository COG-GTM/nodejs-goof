var tap = require('tap');
var http = require('http');
var crypto = require('crypto');
var express = require('express');
var session = require('express-session');
var sessionOptions = require('../../session-options');

function sign(value, secret) {
  return 's:' + value + '.' + crypto.createHmac('sha256', secret).update(value).digest('base64').replace(/=+$/, '');
}

function startApp(opts, cb) {
  var app = express();
  app.use(session(opts));
  app.get('/login', function (req, res) { req.session.loggedIn = 1; res.end('ok'); });
  app.get('/whoami', function (req, res) { res.end(req.session.loggedIn === 1 ? 'admin' : 'anon'); });
  var server = app.listen(0, function () { cb(server, server.address().port); });
}

function get(port, path, headers, cb) {
  http.get({ port: port, path: path, headers: headers || {} }, function (res) {
    var body = '';
    res.on('data', function (c) { body += c; });
    res.on('end', function () { cb(res, body); });
  });
}

tap.test('does not use the hardcoded "keyboard cat" secret', function (t) {
  t.notEqual(sessionOptions({}).secret, 'keyboard cat');
  t.notEqual(sessionOptions({ NODE_ENV: 'development' }).secret, 'keyboard cat');
  t.end();
});

tap.test('uses SESSION_SECRET from the environment', function (t) {
  t.equal(sessionOptions({ SESSION_SECRET: 's3cr3t-from-env' }).secret, 's3cr3t-from-env');
  t.end();
});

tap.test('generates a random secret in development when SESSION_SECRET is unset', function (t) {
  var a = sessionOptions({}).secret;
  var b = sessionOptions({}).secret;
  t.ok(a.length >= 32);
  t.notEqual(a, b);
  t.end();
});

tap.test('refuses to start in production without SESSION_SECRET', function (t) {
  t.throws(function () { sessionOptions({ NODE_ENV: 'production' }); }, /SESSION_SECRET/);
  t.end();
});

tap.test('hardens session cookie options', function (t) {
  var dev = sessionOptions({}).cookie;
  t.equal(dev.httpOnly, true);
  t.equal(dev.sameSite, 'lax');
  t.equal(dev.secure, false, 'secure is off in development so http://localhost works');
  var prod = sessionOptions({ NODE_ENV: 'production', SESSION_SECRET: 'x' }).cookie;
  t.equal(prod.secure, true);
  t.equal(prod.httpOnly, true);
  t.equal(prod.sameSite, 'lax');
  t.end();
});

tap.test('Set-Cookie carries HttpOnly and SameSite=Lax', function (t) {
  startApp(sessionOptions({}), function (server, port) {
    get(port, '/login', {}, function (res) {
      var cookie = (res.headers['set-cookie'] || [])[0] || '';
      t.match(cookie, /^connect\.sid=/);
      t.match(cookie, /HttpOnly/);
      t.match(cookie, /SameSite=Lax/);
      server.close();
      t.end();
    });
  });
});

tap.test('session cookie forged with "keyboard cat" is rejected', function (t) {
  startApp(sessionOptions({}), function (server, port) {
    get(port, '/login', {}, function (res) {
      var real = decodeURIComponent(res.headers['set-cookie'][0].split(';')[0].split('=')[1]);
      var sid = real.slice(2, real.lastIndexOf('.'));
      var forged = 'connect.sid=' + encodeURIComponent(sign(sid, 'keyboard cat'));
      get(port, '/whoami', { Cookie: forged }, function (res2, body) {
        t.equal(body, 'anon');
        get(port, '/whoami', { Cookie: 'connect.sid=' + encodeURIComponent(real) }, function (res3, body3) {
          t.equal(body3, 'admin', 'legitimately signed cookie still works');
          server.close();
          t.end();
        });
      });
    });
  });
});
