const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

mongoose.model('Todo', new mongoose.Schema({ content: Buffer, updated_at: Date }));
const User = mongoose.model('User', new mongoose.Schema({ username: String, password: String }));
const routes = require('../routes');

const ADMIN = { username: 'admin@snyk.io', password: 'SuperSecretPassword' };

function matches(value, condition) {
  if (condition && typeof condition === 'object') {
    if ('$ne' in condition) return value !== condition.$ne;
    if ('$gt' in condition) return value > condition.$gt;
    return false;
  }
  return value === condition;
}

User.find = function (query, cb) {
  User.find.calls.push(query);
  const hit = matches(ADMIN.username, query.username) && matches(ADMIN.password, query.password);
  setImmediate(cb, null, hit ? [ADMIN] : []);
};

function login(body) {
  User.find.calls = [];
  return new Promise((resolve) => {
    const res = {
      status(code) { this.statusCode = code; return this; },
      send() { resolve({ status: this.statusCode, calls: User.find.calls }); },
      redirect(location) { resolve({ status: 302, location, calls: User.find.calls }); },
    };
    routes.loginHandler({ body, session: {} }, res, (err) => resolve({ err }));
  });
}

test('valid credentials still log in', async () => {
  const r = await login({ username: ADMIN.username, password: ADMIN.password });
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.location, '/admin');
});

test('wrong password is rejected', async () => {
  const r = await login({ username: ADMIN.username, password: 'nope' });
  assert.strictEqual(r.status, 401);
});

test('operator object in password is rejected before querying', async () => {
  const r = await login({ username: ADMIN.username, password: { $ne: 'x' } });
  assert.strictEqual(r.status, 401);
  assert.deepStrictEqual(r.calls, []);
});

test('operator object in username is rejected before querying', async () => {
  const r = await login({ username: { $gt: '' }, password: ADMIN.password });
  assert.strictEqual(r.status, 401);
  assert.deepStrictEqual(r.calls, []);
});

test('array values are rejected before querying', async () => {
  const r = await login({ username: [ADMIN.username], password: [ADMIN.password] });
  assert.strictEqual(r.status, 401);
  assert.deepStrictEqual(r.calls, []);
});
