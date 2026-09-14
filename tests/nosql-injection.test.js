const { test } = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { mockRes } = require('./helpers');
const routes = require('../routes');

const User = mongoose.model('User');

function stubUserFind(t, impl) {
  const original = User.find;
  User.find = impl;
  t.after(() => { User.find = original; });
}

test('POST /login rejects MongoDB operator objects in the password field', async (t) => {
  let queried = false;
  stubUserFind(t, () => { queried = true; return { exec: async () => [{ username: 'admin@snyk.io' }] }; });

  const res = mockRes();
  routes.loginHandler({ body: { username: 'admin@snyk.io', password: { $gt: '' } }, session: {} }, res, assert.ifError);
  await res.finished;

  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(queried, false, 'database must not be queried with operator payloads');
});

test('POST /login rejects operator objects in the username field', async (t) => {
  let queried = false;
  stubUserFind(t, () => { queried = true; return { exec: async () => [{}] }; });

  const res = mockRes();
  routes.loginHandler({ body: { username: { $gt: '' }, password: { $gt: '' } }, session: {} }, res, assert.ifError);
  await res.finished;

  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(queried, false);
});

test('POST /login queries with equality-only filters for valid string credentials', async (t) => {
  let filter;
  stubUserFind(t, (f) => { filter = f; return { exec: async () => [{ username: 'admin@snyk.io' }] }; });

  const res = mockRes();
  const session = {};
  routes.loginHandler({ body: { username: 'admin@snyk.io', password: 'SuperSecretPassword' }, session }, res, assert.ifError);
  await res.finished;

  assert.deepStrictEqual(filter, {
    username: { $eq: 'admin@snyk.io' },
    password: { $eq: 'SuperSecretPassword' },
  });
  assert.strictEqual(res.redirectedTo, '/admin');
  assert.strictEqual(session.loggedIn, 1);
});
