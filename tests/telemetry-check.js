const assert = require('assert');
const mongoose = require('mongoose');

mongoose.model('Todo', new mongoose.Schema({}));
mongoose.model('User', new mongoose.Schema({ username: String, password: String }));

const telemetry = require('../service/telemetry');
const routes = require('../routes');

const lines = [];
const write = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk) => { lines.push(String(chunk)); return true; };

function res() {
  const r = { statusCode: null, redirected: null };
  r.status = (code) => { r.statusCode = code; return r; };
  r.send = () => r;
  r.redirect = (url) => { r.redirected = url; return r; };
  return r;
}

const User = mongoose.model('User');
User.find = (query, cb) => cb(null, query.password === 'good' ? [{ username: query.username }] : []);

routes.loginHandler({ body: { username: 'not-an-email' }, ip: '10.0.0.1', headers: {}, session: {} }, res());
routes.loginHandler({ body: { username: 'admin@snyk.io', password: 'bad' }, ip: '10.0.0.2', headers: {}, session: {} }, res());
const ok = res();
routes.loginHandler({ body: { username: 'admin@snyk.io', password: 'good' }, ip: '10.0.0.3', headers: {}, session: {} }, ok, () => {});

User.find = (query, cb) => cb(new Error('boom'));
let nexted = null;
routes.loginHandler({ body: { username: 'admin@snyk.io', password: 'good' }, ip: '10.0.0.4', headers: {}, session: {} }, res(), (e) => { nexted = e; });

const metrics = telemetry.renderMetrics();
process.stdout.write = write;

const events = lines.map((line) => JSON.parse(line));
assert.deepStrictEqual(events.map((e) => e.event), ['login_failed', 'login_failed', 'login_succeeded', 'login_failed']);
assert.deepStrictEqual(events.map((e) => e.reason), ['invalid_username_format', 'invalid_credentials', undefined, 'lookup_error']);
assert.strictEqual(events[1].usernameHash, telemetry.hashUsername('admin@snyk.io'));
assert.strictEqual(events[1].sourceIp, '10.0.0.2');
assert.ok(!JSON.stringify(events).includes('bad'), 'passwords must never be logged');
assert.strictEqual(events[2].username, 'admin@snyk.io');
assert.strictEqual(ok.redirected, '/admin');
assert.strictEqual(nexted.message, 'boom');

assert.ok(metrics.includes('login_succeeded_total 1'));
assert.ok(metrics.includes('login_failed_total{reason="invalid_credentials"} 1'));
assert.ok(metrics.includes('login_failed_total{reason="invalid_username_format"} 1'));
assert.ok(metrics.includes('login_failed_total{reason="lookup_error"} 1'));

console.log('telemetry checks passed');
console.log(metrics);
