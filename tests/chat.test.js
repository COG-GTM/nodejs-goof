'use strict';

const http = require('http');
const tap = require('tap');
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

// routes/index.js resolves the Todo and User models at require time. Register
// bare schemas so the chat handlers can be loaded without a database.
mongoose.model('Todo', new mongoose.Schema({}));
mongoose.model('User', new mongoose.Schema({}));

const routes = require('../routes');

const USER = routes.chatUsers.find((u) => !u.canDelete);
const ADMIN = routes.chatUsers.find((u) => u.canDelete);

function startServer() {
  const app = express();
  app.use(bodyParser.json());
  app.get('/chat', routes.chat.get);
  app.put('/chat', routes.chat.add);
  app.delete('/chat', routes.chat.delete);
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function request(server, method, body) {
  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
  const options = {
    host: '127.0.0.1',
    port: server.address().port,
    path: '/chat',
    method,
    headers: payload
      ? { 'content-type': 'application/json', 'content-length': payload.length }
      : {},
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function auth(user) {
  return { name: user.name, password: user.password };
}

tap.test('chat', async (t) => {
  const server = await startServer();
  t.teardown(() => server.close());

  await t.test('add denies requests without auth', async (t) => {
    const res = await request(server, 'PUT', { message: { text: 'anonymous' } });
    t.equal(res.status, 403);
    t.same(res.body, { ok: false, error: 'Access denied' });

    const messages = await request(server, 'GET');
    t.notOk(messages.body.some((m) => m.text === 'anonymous'));
  });

  await t.test('add denies requests with a wrong password', async (t) => {
    const res = await request(server, 'PUT', {
      auth: { name: USER.name, password: 'not-the-password' },
      message: { text: 'impostor' },
    });
    t.equal(res.status, 403);

    const messages = await request(server, 'GET');
    t.notOk(messages.body.some((m) => m.text === 'impostor'));
  });

  await t.test('add stores the message for an authenticated user', async (t) => {
    const res = await request(server, 'PUT', {
      auth: auth(USER),
      message: { text: 'hello' },
    });
    t.equal(res.status, 200);
    t.same(res.body, { ok: true });

    const messages = await request(server, 'GET');
    const message = messages.body.find((m) => m.text === 'hello');
    t.ok(message);
    t.equal(message.userName, USER.name);
    t.equal(message.icon, '👋', 'default icon is applied');
    t.type(message.id, 'number');
    t.type(message.timestamp, 'number');
  });

  await t.test('add lets the user override the default icon', async (t) => {
    await request(server, 'PUT', {
      auth: auth(USER),
      message: { text: 'custom icon', icon: '🔥' },
    });

    const messages = await request(server, 'GET');
    t.equal(messages.body.find((m) => m.text === 'custom icon').icon, '🔥');
  });

  await t.test('add cannot be used to spoof another user name', async (t) => {
    await request(server, 'PUT', {
      auth: auth(USER),
      message: { text: 'spoof', userName: ADMIN.name },
    });

    const messages = await request(server, 'GET');
    t.equal(messages.body.find((m) => m.text === 'spoof').userName, USER.name);
  });

  await t.test('delete denies requests without auth', async (t) => {
    await request(server, 'PUT', { auth: auth(USER), message: { text: 'keep me' } });
    const before = await request(server, 'GET');
    const target = before.body.find((m) => m.text === 'keep me');

    const res = await request(server, 'DELETE', { messageId: target.id });
    t.equal(res.status, 403);
    t.same(res.body, { ok: false, error: 'Access denied' });

    const after = await request(server, 'GET');
    t.ok(after.body.some((m) => m.id === target.id), 'message is still there');
  });

  await t.test('delete denies a user without canDelete', async (t) => {
    const before = await request(server, 'GET');
    const target = before.body.find((m) => m.text === 'keep me');

    const res = await request(server, 'DELETE', {
      auth: auth(USER),
      messageId: target.id,
    });
    t.equal(res.status, 403);

    const after = await request(server, 'GET');
    t.ok(after.body.some((m) => m.id === target.id), 'message is still there');
  });

  await t.test('delete removes the message for a user with canDelete', async (t) => {
    const before = await request(server, 'GET');
    const target = before.body.find((m) => m.text === 'keep me');

    const res = await request(server, 'DELETE', {
      auth: auth(ADMIN),
      messageId: target.id,
    });
    t.equal(res.status, 200);
    t.same(res.body, { ok: true });

    const after = await request(server, 'GET');
    t.notOk(after.body.some((m) => m.id === target.id));
    t.ok(after.body.length < before.body.length);
  });

  // Documents the known prototype pollution sink in chat.add (_.merge with a
  // user-controlled object). The app is vulnerable by design; this test pins
  // the behaviour so a change to it is visible.
  await t.test('add merges attacker controlled keys into Object.prototype', async (t) => {
    t.teardown(() => {
      delete Object.prototype.polluted;
      delete Object.prototype.polluted2;
    });

    await request(server, 'PUT', {
      auth: auth(USER),
      message: JSON.parse('{"text":"pp","__proto__":{"polluted":"yes"}}'),
    });
    t.equal({}.polluted, 'yes', '__proto__ payload reaches Object.prototype');

    await request(server, 'PUT', {
      auth: auth(USER),
      message: JSON.parse('{"text":"pp2","constructor":{"prototype":{"polluted2":"yes"}}}'),
    });
    t.equal({}.polluted2, 'yes', 'constructor.prototype payload reaches Object.prototype');
  });
});

tap.test('findUser', (t) => {
  t.equal(routes.findUser(auth(USER)), USER, 'matches on name and password');
  t.equal(routes.findUser({ name: USER.name, password: 'wrong' }), undefined);
  t.equal(routes.findUser({ name: 'nobody', password: USER.password }), undefined);
  t.equal(routes.findUser({}), undefined, 'empty auth matches nobody');
  t.end();
});
