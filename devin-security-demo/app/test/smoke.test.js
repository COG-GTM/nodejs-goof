const test = require('node:test');
const assert = require('node:assert');
const app = require('../server');

async function withServer(fn) {
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { server.close(); }
}

async function login(base, username) {
  const res = await fetch(`${base}/api/session/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: `${username}123` })
  });
  return (await res.json()).token;
}

test('owner can read their note, others cannot', () => withServer(async (base) => {
  const alice = await login(base, 'alice');
  const bob = await login(base, 'bob');
  const ok = await fetch(`${base}/api/notes/1`, { headers: { authorization: `Bearer ${alice}` } });
  assert.strictEqual(ok.status, 200);
  const denied = await fetch(`${base}/api/notes/1`, { headers: { authorization: `Bearer ${bob}` } });
  assert.strictEqual(denied.status, 404);
}));

test('share link returns the note', () => withServer(async (base) => {
  const alice = await login(base, 'alice');
  const note = await (await fetch(`${base}/api/notes/2`, { headers: { authorization: `Bearer ${await login(base, 'bob')}` } })).json();
  const res = await fetch(`${base}/share/${note.shareToken}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).title, 'Groceries');
  assert.ok(alice);
}));

test('files require login', () => withServer(async (base) => {
  const res = await fetch(`${base}/api/files?name=welcome.txt`);
  assert.strictEqual(res.status, 401);
}));
