const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const express = require('express');
const session = require('express-session');
const sessionConfig = require('../session-config');

const SECRET = 'a'.repeat(sessionConfig.MIN_SECRET_LENGTH);

test('rejects a missing session secret', () => {
  assert.throws(() => sessionConfig.sessionOptions({}), /SESSION_SECRET must be set/);
});

test('rejects short secrets such as the express example value', () => {
  assert.throws(() => sessionConfig.sessionOptions({ SESSION_SECRET: 'keyboard cat' }), /at least 32/);
});

test('uses the secret from the environment with hardened cookie flags', () => {
  const options = sessionConfig.sessionOptions({ SESSION_SECRET: SECRET });
  assert.strictEqual(options.secret, SECRET);
  assert.deepStrictEqual(options.cookie, { path: '/', httpOnly: true, secure: true, sameSite: 'lax' });
  assert.strictEqual(options.proxy, undefined);
});

test('allows opting out of secure cookies for plain-HTTP local runs and trusting a proxy', () => {
  const options = sessionConfig.sessionOptions({
    SESSION_SECRET: SECRET,
    SESSION_COOKIE_SECURE: 'false',
    SESSION_TRUST_PROXY: 'true'
  });
  assert.strictEqual(options.cookie.secure, false);
  assert.strictEqual(options.cookie.httpOnly, true);
  assert.strictEqual(options.proxy, true);
});

function setCookieFor(env, headers) {
  const app = express();
  app.use(session(sessionConfig.sessionOptions(env)));
  app.get('/', (req, res) => {
    req.session.loggedIn = 1;
    res.end('ok');
  });
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      http.get({ port: server.address().port, path: '/', headers: headers || {} }, (res) => {
        res.resume();
        server.close();
        resolve(res.headers['set-cookie'] || []);
      }).on('error', reject);
    });
  });
}

test('emits a Secure, HttpOnly, SameSite=Lax session cookie behind a trusted TLS proxy', async () => {
  const cookies = await setCookieFor(
    { SESSION_SECRET: SECRET, SESSION_TRUST_PROXY: 'true' },
    { 'X-Forwarded-Proto': 'https' }
  );
  assert.strictEqual(cookies.length, 1);
  assert.match(cookies[0], /^connect\.sid=/);
  assert.match(cookies[0], /; HttpOnly/);
  assert.match(cookies[0], /; Secure/);
  assert.match(cookies[0], /; SameSite=Lax/);
});

test('never sends the Secure session cookie over plain HTTP', async () => {
  const cookies = await setCookieFor({ SESSION_SECRET: SECRET });
  assert.deepStrictEqual(cookies, []);
});

test('sends an HttpOnly cookie over plain HTTP only when secure cookies are disabled', async () => {
  const cookies = await setCookieFor({ SESSION_SECRET: SECRET, SESSION_COOKIE_SECURE: 'false' });
  assert.strictEqual(cookies.length, 1);
  assert.match(cookies[0], /; HttpOnly/);
  assert.doesNotMatch(cookies[0], /; Secure/);
});
