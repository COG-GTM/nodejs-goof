const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const { runRouter, fakeRepo } = require('./helpers');
const usersRouter = require('../routes/users');

beforeEach(() => { fakeRepo.calls.length = 0; });

test('POST /users rejects nested objects that would pollute the prototype via the ORM', async () => {
  const body = JSON.parse('{"name":"a","address":{"__proto__":{"where":{"id":"2","where":null}}},"role":"user"}');
  const res = await runRouter(usersRouter, 'POST', '/', body);

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(fakeRepo.calls.length, 0, 'ORM must not be called with a nested payload');
  assert.strictEqual({}.where, undefined, 'Object.prototype was polluted');
});

test('POST /users rejects missing or non-string columns', async () => {
  for (const body of [
    { name: 'a', address: 'b' },
    { name: 'a', address: 'b', role: 1 },
    { name: ['a'], address: 'b', role: 'user' },
    null,
    'string',
  ]) {
    const res = await runRouter(usersRouter, 'POST', '/', body);
    assert.strictEqual(res.statusCode, 400, `expected 400 for ${JSON.stringify(body)}`);
  }
  assert.strictEqual(fakeRepo.calls.length, 0);
});

test('POST /users saves only the whitelisted string columns', async () => {
  const res = await runRouter(usersRouter, 'POST', '/', { name: 'a', address: 'b', role: 'user', id: 42, isAdmin: true });

  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(fakeRepo.calls, [['save', { name: 'a', address: 'b', role: 'user' }]]);
});

test('GET /users uses an explicit where clause that a polluted prototype cannot override', async () => {
  Object.prototype.where = { id: 2 };
  try {
    await runRouter(usersRouter, 'GET', '/');
    const [method, opts] = fakeRepo.calls[0];
    assert.strictEqual(method, 'find');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(opts, 'where'), true);
    assert.deepStrictEqual(opts.where, { id: 1 });
  } finally {
    delete Object.prototype.where;
  }
});
