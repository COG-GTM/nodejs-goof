'use strict';

const tap = require('tap');
const mongoose = require('mongoose');

// routes/index.js looks up these models at load time; register stubs so the
// chat handler can be exercised without a MongoDB connection.
['Todo', 'User'].forEach((name) => {
  if (!mongoose.modelNames().includes(name)) {
    mongoose.model(name, new mongoose.Schema({}));
  }
});

const routes = require('../../routes');

function addMessage(message) {
  let response;
  const req = { body: { auth: { name: 'user', password: 'pwd' }, message } };
  const res = {
    status() { return this; },
    send(body) { response = body; },
  };
  routes.chat.add(req, res);
  return response;
}

tap.test('chat.add does not pollute Object.prototype via __proto__', (t) => {
  const message = JSON.parse('{"text":"hi","__proto__":{"sec04Proto":true}}');
  t.same(addMessage(message), { ok: true });
  t.equal({}.sec04Proto, undefined);
  delete Object.prototype.sec04Proto;
  t.end();
});

tap.test('chat.add does not pollute Object.prototype via constructor.prototype', (t) => {
  const message = JSON.parse('{"text":"hi","constructor":{"prototype":{"sec04Ctor":true}}}');
  t.same(addMessage(message), { ok: true });
  t.equal({}.sec04Ctor, undefined);
  delete Object.prototype.sec04Ctor;
  t.end();
});

tap.test('chat.add still merges legitimate message fields', (t) => {
  t.same(addMessage({ text: 'hello', icon: '🎉' }), { ok: true });
  const messages = [];
  routes.chat.get({}, { send: (m) => messages.push(...m) });
  const msg = messages[messages.length - 1];
  t.equal(msg.text, 'hello');
  t.equal(msg.icon, '🎉');
  t.equal(msg.userName, 'user');
  t.end();
});
