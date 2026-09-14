const { test } = require('node:test');
const assert = require('node:assert');
const { mockRes } = require('./helpers');
const routes = require('../routes');

const userAuth = { name: 'user', password: 'pwd' };

async function put(message) {
  const res = mockRes();
  routes.chat.add({ body: { auth: userAuth, message } }, res);
  await res.finished;
  return res;
}

async function del(messageId) {
  const res = mockRes();
  routes.chat.delete({ body: { auth: userAuth, messageId } }, res);
  await res.finished;
  return res;
}

test('PUT /chat with a __proto__ payload does not pollute Object.prototype', async () => {
  const payload = JSON.parse('{"text":"hi","__proto__":{"canDelete":true}}');
  const res = await put(payload);

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual({}.canDelete, undefined, 'Object.prototype was polluted');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(Object.prototype, 'canDelete'), false);
});

test('PUT /chat with constructor.prototype payload does not pollute Object.prototype', async () => {
  const res = await put({ text: 'hi', constructor: { prototype: { canDelete: true } } });

  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual({}.canDelete, undefined);
});

test('a regular user still cannot DELETE /chat after a pollution attempt', async () => {
  await put(JSON.parse('{"text":"evil","__proto__":{"canDelete":true}}'));
  const res = await del(1);

  assert.strictEqual(res.statusCode, 403);
  assert.deepStrictEqual(res.body, { ok: false, error: 'Access denied' });
});

test('PUT /chat only keeps own string fields and never lets the client override id/userName', async () => {
  await put({ text: 'hello', icon: ':)', id: 9999, userName: 'admin', nested: { a: 1 } });
  const res = mockRes();
  routes.chat.get({}, res);
  const last = res.body[res.body.length - 1];

  assert.strictEqual(last.text, 'hello');
  assert.strictEqual(last.icon, ':)');
  assert.strictEqual(last.userName, 'user');
  assert.notStrictEqual(last.id, 9999);
  assert.strictEqual(last.nested, undefined);
});
