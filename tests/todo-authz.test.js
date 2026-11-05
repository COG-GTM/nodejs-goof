const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const Todo = mongoose.model('Todo', new mongoose.Schema({ content: Buffer, updated_at: Date, owner: String }));
mongoose.model('User', new mongoose.Schema({ username: String, password: String }));
const routes = require('../routes');

const ALICE_ID = '5f0c3b2a9d1e8a0012345678';
let store;

Todo.findOne = function (query, cb) {
  const doc = store.find((d) => d._id === String(query._id) && d.owner === query.owner) || null;
  setImmediate(cb, null, doc);
};

function makeTodo(owner) {
  const doc = { _id: ALICE_ID, owner, content: 'alice todo' };
  doc.remove = (cb) => { store = store.filter((d) => d !== doc); setImmediate(cb, null, doc); };
  doc.save = (cb) => setImmediate(cb, null, doc, 1);
  return doc;
}

function call(handler, req) {
  return new Promise((resolve) => {
    const res = {
      locals: {},
      status(code) { this.statusCode = code; return this; },
      send() { resolve({ status: this.statusCode }); },
      redirect(location) { resolve({ status: 302, location }); },
    };
    req.get = () => undefined;
    handler(req, res, (err) => resolve({ next: true, err }));
  });
}

const session = (username) => ({ loggedIn: 1, username, csrfToken: 'a'.repeat(64) });

test.beforeEach(() => { store = [makeTodo('alice@example.com')]; });

test('anonymous requests are redirected by isLoggedIn', async () => {
  const r = await call(routes.isLoggedIn, { session: {} });
  assert.deepStrictEqual(r, { status: 302, location: '/' });
});

test('verifyCsrf rejects missing and wrong tokens', async () => {
  assert.strictEqual((await call(routes.verifyCsrf, { session: session('alice@example.com'), body: {} })).status, 403);
  assert.strictEqual((await call(routes.verifyCsrf, { session: session('alice@example.com'), body: { _csrf: 'b'.repeat(64) } })).status, 403);
  assert.strictEqual((await call(routes.verifyCsrf, { session: {}, body: { _csrf: 'x' } })).status, 403);
});

test('verifyCsrf accepts the session token', async () => {
  const r = await call(routes.verifyCsrf, { session: session('alice@example.com'), body: { _csrf: 'a'.repeat(64) } });
  assert.strictEqual(r.next, true);
});

test('destroy by a different user returns 404 and keeps the todo', async () => {
  const r = await call(routes.destroy, { session: session('bob@example.com'), params: { id: ALICE_ID } });
  assert.strictEqual(r.status, 404);
  assert.strictEqual(store.length, 1);
});

test('destroy without a session username does not match ownerless lookups', async () => {
  const r = await call(routes.destroy, { session: { loggedIn: 1 }, params: { id: ALICE_ID } });
  assert.strictEqual(r.status, 404);
  assert.strictEqual(store.length, 1);
});

test('destroy by the owner removes the todo', async () => {
  const r = await call(routes.destroy, { session: session('alice@example.com'), params: { id: ALICE_ID } });
  assert.deepStrictEqual(r, { status: 302, location: '/' });
  assert.strictEqual(store.length, 0);
});

test('update by a different user returns 404 and leaves content unchanged', async () => {
  const r = await call(routes.update, { session: session('bob@example.com'), params: { id: ALICE_ID }, body: { content: 'defaced' } });
  assert.strictEqual(r.status, 404);
  assert.strictEqual(store[0].content, 'alice todo');
});

test('update by the owner changes content', async () => {
  const r = await call(routes.update, { session: session('alice@example.com'), params: { id: ALICE_ID }, body: { content: 'edited' } });
  assert.strictEqual(r.status, 302);
  assert.strictEqual(store[0].content, 'edited');
});

test('malformed ids return 404', async () => {
  const r = await call(routes.destroy, { session: session('alice@example.com'), params: { id: 'not-an-id' } });
  assert.strictEqual(r.status, 404);
});
