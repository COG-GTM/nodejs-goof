const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

mongoose.model('Todo', new mongoose.Schema({ content: Buffer, updated_at: Date }));
const User = mongoose.model('User', new mongoose.Schema({ username: String, password: String }));
const routes = require('../routes');

function login(body, users = []) {
  const queries = [];
  User.find = (query, cb) => { queries.push(query); cb(null, users); };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    send() { return this; },
    redirect(url) { this.statusCode = 302; this.location = url; return this; },
  };
  routes.loginHandler({ body, session: {} }, res, (err) => { throw err; });
  return { res, queries };
}

const operatorPayloads = {
  'password $gt': { username: 'admin@snyk.io', password: { $gt: '' } },
  'password $ne': { username: 'admin@snyk.io', password: { $ne: 'x' } },
  'username and password $gt': { username: { $gt: '' }, password: { $gt: '' } },
  'password array': { username: 'admin@snyk.io', password: ['SuperSecretPassword'] },
};

for (const [name, body] of Object.entries(operatorPayloads)) {
  test(`rejects operator injection: ${name}`, () => {
    const { res, queries } = login(body, [{ username: 'admin@snyk.io' }]);
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(queries.length, 0);
  });
}

test('queries with literal $eq string values', () => {
  const { res, queries } = login({ username: 'admin@snyk.io', password: 'SuperSecretPassword' }, [{ username: 'admin@snyk.io' }]);
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.location, '/admin');
  assert.deepStrictEqual(queries, [{ username: { $eq: 'admin@snyk.io' }, password: { $eq: 'SuperSecretPassword' } }]);
});

test('rejects wrong password', () => {
  const { res } = login({ username: 'admin@snyk.io', password: 'nope' }, []);
  assert.strictEqual(res.statusCode, 401);
});
