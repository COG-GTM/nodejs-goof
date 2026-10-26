// Regression test for CVE-2019-10744 / CVE-2020-8203 (lodash prototype pollution)
// reachable through PUT /chat -> routes.chat.add -> _.merge(message, req.body.message).
// Run with: node tests/chat-prototype-pollution.test.js
const http = require('http');
const tap = require('tap');
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

// routes/index.js looks up these models at load time; register them without
// opening a database connection (the chat handler does not use MongoDB).
mongoose.model('Todo', new mongoose.Schema({}));
mongoose.model('User', new mongoose.Schema({}));
const routes = require('../routes');

const app = express();
app.use(bodyParser.json());
app.get('/chat', routes.chat.get);
app.put('/chat', routes.chat.add);

const auth = { name: 'user', password: 'pwd' };

function request(server, method, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? '' : JSON.stringify(body);
    const req = http.request({
      host: '127.0.0.1',
      port: server.address().port,
      path: '/chat',
      method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
    });
    req.on('error', reject);
    req.end(payload);
  });
}

tap.test('PUT /chat does not pollute Object.prototype', (t) => {
  const server = app.listen(0, '127.0.0.1', async () => {
    try {
      const protoRes = await request(server, 'PUT', {
        auth,
        message: JSON.parse('{"__proto__": {"polluted": "yes"}}'),
      });
      t.equal(protoRes.status, 200, '__proto__ payload is accepted');
      t.equal(({}).polluted, undefined, '__proto__ payload does not set ({}).polluted');

      const ctorRes = await request(server, 'PUT', {
        auth,
        message: { constructor: { prototype: { polluted: 'yes' } } },
      });
      t.equal(ctorRes.status, 200, 'constructor.prototype payload is accepted');
      t.equal(({}).polluted, undefined, 'constructor.prototype payload does not set ({}).polluted');

      const okRes = await request(server, 'PUT', {
        auth,
        message: { text: 'hello', icon: '🚀', meta: { tags: ['a', 'b'] } },
      });
      t.same(okRes.body, { ok: true }, 'normal message is accepted');

      const denied = await request(server, 'PUT', { auth: { name: 'user', password: 'nope' }, message: { text: 'x' } });
      t.equal(denied.status, 403, 'bad credentials are still rejected');

      const list = await request(server, 'GET');
      const last = list.body[list.body.length - 1];
      t.equal(last.text, 'hello', 'message text is preserved');
      t.equal(last.icon, '🚀', 'user can still override the default icon');
      t.same(last.meta, { tags: ['a', 'b'] }, 'nested message fields are preserved');
      t.equal(last.userName, 'user', 'server-controlled userName is set');
      t.type(last.id, 'number', 'server-controlled id is set');
    } catch (err) {
      t.error(err);
    } finally {
      delete Object.prototype.polluted;
      server.close();
      t.end();
    }
  });
});
