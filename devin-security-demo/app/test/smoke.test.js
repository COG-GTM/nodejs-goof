const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
const app = require('../server');
const { sign } = require('../auth');

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

test('token forged with the old hardcoded secret is rejected', () => withServer(async (base) => {
  const mac = crypto.createHmac('sha256', 'acme-notes-dev-secret-2019').update('1').digest('hex');
  const res = await fetch(`${base}/api/notes`, { headers: { authorization: `Bearer 1.${mac}` } });
  assert.strictEqual(res.status, 401);
}));

test('expired token is rejected', () => withServer(async (base) => {
  const expired = sign(1, Date.now() - 2 * 3600 * 1000);
  const res = await fetch(`${base}/api/notes`, { headers: { authorization: `Bearer ${expired}` } });
  assert.strictEqual(res.status, 401);
}));

test('token with a tampered user id is rejected', () => withServer(async (base) => {
  const [payload, sig] = (await login(base, 'mallory')).split('.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  const forged = Buffer.from(JSON.stringify({ ...claims, sub: 1 })).toString('base64url');
  const res = await fetch(`${base}/api/notes`, { headers: { authorization: `Bearer ${forged}.${sig}` } });
  assert.strictEqual(res.status, 401);
}));

test('server refuses to start without SESSION_SECRET', () => {
  const { spawnSync } = require('node:child_process');
  const env = { ...process.env };
  delete env.SESSION_SECRET;
  const out = spawnSync(process.execPath, ['-e', "require('./config')"], { cwd: require('node:path').join(__dirname, '..'), env });
  assert.notStrictEqual(out.status, 0);
  assert.match(out.stderr.toString(), /SESSION_SECRET/);
});
