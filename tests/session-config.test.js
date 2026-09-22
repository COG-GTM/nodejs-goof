var fs = require('fs');
var path = require('path');
var test = require('tap').test;
var utils = require('../utils');

test('session secret is not hard-coded in app.js', function (t) {
  var app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  t.notMatch(app, /secret\s*:\s*['"`]/, 'no literal session secret in app.js');
  t.match(app, /secret:\s*utils\.session_secret\(\)/, 'secret comes from utils');
  t.match(app, /cookie:\s*utils\.session_cookie\(\)/, 'cookie comes from utils');
  t.end();
});

test('session_secret uses SESSION_SECRET when strong enough', function (t) {
  var secret = 'a'.repeat(32);
  t.equal(utils.session_secret({ SESSION_SECRET: secret }), secret);
  t.end();
});

test('session_secret rejects weak/missing secret in production', function (t) {
  t.throws(function () {
    utils.session_secret({ NODE_ENV: 'production' });
  }, 'throws when unset in production');
  t.throws(function () {
    utils.session_secret({ NODE_ENV: 'production', SESSION_SECRET: 'short' });
  }, 'throws when too short in production');
  t.end();
});

test('session_secret falls back to a random secret outside production', function (t) {
  var first = utils.session_secret({});
  var second = utils.session_secret({});
  t.ok(first.length >= 32, 'generated secret is long enough');
  t.not(first, 'keyboard cat', 'generated secret is not the known value');
  t.not(first, second, 'generated secret is random per call');
  t.end();
});

test('session_cookie sets hardening flags', function (t) {
  var dev = utils.session_cookie({});
  t.equal(dev.httpOnly, true, 'httpOnly set');
  t.equal(dev.sameSite, 'lax', 'sameSite set');
  t.equal(dev.path, '/', 'path preserved');
  t.equal(dev.secure, false, 'not secure outside production by default');

  t.equal(utils.session_cookie({ NODE_ENV: 'production' }).secure, true,
    'secure in production');
  t.equal(utils.session_cookie({ SESSION_COOKIE_SECURE: 'true' }).secure, true,
    'secure can be forced on');
  t.equal(
    utils.session_cookie({ NODE_ENV: 'production', SESSION_COOKIE_SECURE: 'false' }).secure,
    false, 'secure can be forced off');
  t.end();
});
