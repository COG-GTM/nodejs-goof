var tap = require('tap');
var fs = require('fs');
var path = require('path');
var utils = require('../utils');

tap.test('session_secret uses the configured value', function (t) {
  var secret = 'a'.repeat(32);
  t.equal(utils.session_secret({ SESSION_SECRET: secret }), secret);
  t.end();
});

tap.test('session_secret rejects weak or missing secrets in production', function (t) {
  t.throws(function () {
    utils.session_secret({ NODE_ENV: 'production' });
  });
  t.throws(function () {
    utils.session_secret({ NODE_ENV: 'production', SESSION_SECRET: 'short' });
  });
  t.end();
});

tap.test('session_secret generates a random secret when unset outside production', function (t) {
  var first = utils.session_secret({});
  var second = utils.session_secret({});
  t.ok(first.length >= 32);
  t.not(first, second);
  t.end();
});

tap.test('session cookie sets hardening flags', function (t) {
  var dev = utils.session_cookie({});
  t.equal(dev.httpOnly, true);
  t.equal(dev.sameSite, 'lax');
  t.equal(dev.path, '/');
  t.equal(dev.secure, false);
  t.equal(utils.session_cookie({ NODE_ENV: 'production' }).secure, true);
  t.equal(utils.session_cookie({ SESSION_COOKIE_SECURE: 'true' }).secure, true);
  t.end();
});

tap.test('app.js does not hard-code a session secret', function (t) {
  var src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  var config = src.slice(src.indexOf('app.use(session('));
  config = config.slice(0, config.indexOf('}))'));
  t.notMatch(config, /secret:\s*'/, 'secret is not a string literal');
  t.match(config, /utils\.session_secret\(\)/);
  t.match(config, /utils\.session_cookie\(\)/);
  t.end();
});
