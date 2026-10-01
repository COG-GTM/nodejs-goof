// Run with: node tests/login-audit.test.js
var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');

var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'goof-audit-'));
process.env.AUDIT_LOG_PATH = path.join(tmpDir, 'logs', 'audit.log');
process.env.AUDIT_LOG_HMAC_KEY = 'test-hmac-key';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
mongoose.model('Todo', new Schema({ content: Buffer, updated_at: Date }));
var User = mongoose.model('User', new Schema({ username: String, password: String }));

var auditLog = require('../service/auditLog');
var routes = require('../routes');

var EMAIL = 'admin@snyk.io';
var USER_ID = '5f1d7c2e9b1e8a0012345678';

function fakeReq(body) {
  return {
    body: body,
    session: {},
    ip: '203.0.113.7',
    connection: { remoteAddress: '203.0.113.7' },
    headers: { 'user-agent': 'login-audit-test' }
  };
}

function fakeRes(done) {
  var res = {
    statusCode: 200,
    status: function (code) { res.statusCode = code; return res; },
    send: function () { done(res); },
    redirect: function (location) { res.statusCode = 302; res.location = location; done(res); }
  };
  return res;
}

function login(body, findResult) {
  User.find = function (query, cb) { setImmediate(function () { cb(findResult.err || null, findResult.users || []); }); };
  return new Promise(function (resolve) {
    var req = fakeReq(body);
    routes.loginHandler(req, fakeRes(function (res) { resolve({ req: req, res: res }); }), function (err) {
      resolve({ req: req, err: err });
    });
  });
}

function readRecords() {
  return fs.readFileSync(process.env.AUDIT_LOG_PATH, 'utf8').trim().split('\n').map(JSON.parse);
}

(async function () {
  var logged = [];
  var originalLog = console.log;
  console.log = function () { logged.push(Array.prototype.join.call(arguments, ' ')); };

  var ok = await login({ username: EMAIL, password: 'SuperSecretPassword' },
    { users: [{ _id: USER_ID, username: EMAIL }] });
  var bad = await login({ username: EMAIL, password: 'wrong' }, { users: [] });
  var malformed = await login({ username: 'not-an-email', password: 'x' }, { users: [] });
  var broken = await login({ username: EMAIL, password: 'x' }, { err: new Error('db down') });

  console.log = originalLog;

  assert.strictEqual(ok.res.statusCode, 302);
  assert.strictEqual(ok.req.session.loggedIn, 1);
  assert.strictEqual(bad.res.statusCode, 401);
  assert.strictEqual(malformed.res.statusCode, 401);
  assert.strictEqual(broken.err.message, 'db down');
  assert.ok(logged.every(function (line) { return line.indexOf(EMAIL) === -1; }), 'email written to console');

  var raw = fs.readFileSync(process.env.AUDIT_LOG_PATH, 'utf8');
  assert.strictEqual(raw.indexOf(EMAIL), -1, 'email written to audit log');
  assert.strictEqual(raw.indexOf('SuperSecretPassword'), -1, 'password written to audit log');
  assert.strictEqual(fs.statSync(process.env.AUDIT_LOG_PATH).mode & 0o777, 0o600);

  var records = readRecords();
  assert.deepStrictEqual(records.map(function (r) { return [r.event, r.outcome, r.reason]; }), [
    ['auth.login', 'success', null],
    ['auth.login', 'failure', 'invalid_credentials'],
    ['auth.login', 'failure', 'invalid_username_format'],
    ['auth.login', 'error', 'lookup_error']
  ]);
  assert.strictEqual(records[0].actor_id, USER_ID);
  assert.strictEqual(records[1].actor_id, null);
  assert.strictEqual(records[0].actor_ref, records[1].actor_ref);
  assert.match(records[0].actor_ref, /^[0-9a-f]{32}$/);
  records.forEach(function (r) {
    assert.strictEqual(r.source_ip, '203.0.113.7');
    assert.strictEqual(r.user_agent, 'login-audit-test');
    assert.ok(!isNaN(Date.parse(r.ts)));
  });

  assert.deepStrictEqual(auditLog.verify(process.env.AUDIT_LOG_PATH), { valid: true, records: 4 });

  var resumed = new auditLog.AuditLog({ filePath: process.env.AUDIT_LOG_PATH, hmacKey: 'test-hmac-key' });
  var next = resumed.recordLogin(fakeReq({}), 'failure', { reason: 'invalid_credentials', username: EMAIL });
  assert.strictEqual(next.seq, 5);
  assert.strictEqual(next.prev_hash, records[3].hash);
  assert.strictEqual(next.actor_ref, records[0].actor_ref);
  assert.deepStrictEqual(auditLog.verify(process.env.AUDIT_LOG_PATH), { valid: true, records: 5 });

  var lines = fs.readFileSync(process.env.AUDIT_LOG_PATH, 'utf8').split('\n');
  lines[1] = lines[1].replace('"outcome":"failure"', '"outcome":"success"');
  fs.writeFileSync(process.env.AUDIT_LOG_PATH, lines.join('\n'));
  assert.deepStrictEqual(auditLog.verify(process.env.AUDIT_LOG_PATH), { valid: false, records: 5, brokenAt: 2 });

  console.log('login audit tests passed');
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
