const test = require('tap').test;
const mongoose = require('mongoose');

// routes/index.js resolves the Todo/User models at require time.
mongoose.model('Todo', new mongoose.Schema({ content: String, updated_at: Date }));
mongoose.model('User', new mongoose.Schema({ username: String, password: String }));

const routes = require('../routes');

const AUTH = { name: 'user', password: 'pwd' };

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}

test('chat.add ignores __proto__ in the message payload', (t) => {
  const res = fakeRes();
  routes.chat.add({
    body: {
      auth: AUTH,
      // JSON.parse keeps __proto__ as an own key, exactly like a request body.
      message: JSON.parse('{"text":"hi","__proto__":{"polluted":true,"canDelete":true}}'),
    },
  }, res);

  t.same(res.body, { ok: true });
  t.equal({}.polluted, undefined, 'Object.prototype is not polluted');
  t.equal({}.canDelete, undefined, 'Object.prototype.canDelete is not set');
  t.end();
});

test('chat.add ignores constructor.prototype in the message payload', (t) => {
  const res = fakeRes();
  routes.chat.add({
    body: {
      auth: AUTH,
      message: { constructor: { prototype: { pollutedToo: true } } },
    },
  }, res);

  t.same(res.body, { ok: true });
  t.equal({}.pollutedToo, undefined, 'Object.prototype is not polluted');
  t.end();
});

test('chat.add only copies allow-listed string fields', (t) => {
  const res = fakeRes();
  routes.chat.add({
    body: {
      auth: AUTH,
      message: { text: 'hello', icon: 'x', id: 999, userName: 'admin', evil: 'nope' },
    },
  }, res);

  const getRes = fakeRes();
  routes.chat.get({}, getRes);
  const message = getRes.body[getRes.body.length - 1];

  t.equal(message.text, 'hello');
  t.equal(message.icon, 'x');
  t.equal(message.userName, 'user', 'userName is assigned server side');
  t.not(message.id, 999, 'id is assigned server side');
  t.equal(message.evil, undefined, 'unknown fields are dropped');
  t.end();
});

test('chat.delete stays denied for the low privileged user', (t) => {
  const res = fakeRes();
  routes.chat.delete({ body: { auth: AUTH, messageId: 1 } }, res);

  t.equal(res.statusCode, 403);
  t.same(res.body, { ok: false, error: 'Access denied' });
  t.end();
});

test('findUser rejects non string credentials', (t) => {
  const res = fakeRes();
  routes.chat.add({
    body: { auth: { name: { $ne: null }, password: { $ne: null } }, message: {} },
  }, res);

  t.equal(res.statusCode, 403);
  t.end();
});
