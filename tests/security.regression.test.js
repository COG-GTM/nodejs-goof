// Regression tests for the two Snyk findings fixed in this branch:
//   javascript/NoSqli            - NoSQL injection in loginHandler (routes/index.js)
//   npm:adm-zip:20180415         - Zip Slip via AdmZip.extractAllTo (routes/index.js import)
const tap = require('tap');
const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const AdmZip = require('adm-zip');

mongoose.model('Todo', new mongoose.Schema({ content: Buffer, updated_at: Date }));
mongoose.model('User', new mongoose.Schema({ username: String, password: String }));

const routes = require('../routes');
const User = mongoose.model('User');

function fakeRes() {
  const res = { statusCode: null, redirectedTo: null, sent: false };
  res.status = function (code) { res.statusCode = code; return res; };
  res.send = function () { res.sent = true; return res; };
  res.redirect = function (target) { res.redirectedTo = target; return res; };
  return res;
}

function withStubbedFind(users, fn) {
  const original = User.find;
  const calls = [];
  User.find = function (query, cb) {
    calls.push(query);
    cb(null, users);
  };
  try {
    return fn(calls);
  } finally {
    User.find = original;
  }
}

tap.test('loginHandler rejects a MongoDB operator object as password', (t) => {
  withStubbedFind([{ username: 'admin@snyk.io' }], (calls) => {
    const res = fakeRes();
    routes.loginHandler({ body: { username: 'admin@snyk.io', password: { $gt: '' } }, session: {} }, res);

    t.equal(res.statusCode, 401, 'operator injection is rejected with 401');
    t.equal(res.redirectedTo, null, 'no admin redirect is issued');
    t.same(calls, [], 'the injected operator never reaches the query');
  });
  t.end();
});

tap.test('loginHandler still authenticates a valid string credential pair', (t) => {
  withStubbedFind([{ username: 'admin@snyk.io' }], (calls) => {
    const session = {};
    const res = fakeRes();
    routes.loginHandler({ body: { username: 'admin@snyk.io', password: 'SuperSecretPassword' }, session }, res);

    t.equal(res.redirectedTo, '/admin', 'valid login redirects to /admin');
    t.equal(session.loggedIn, 1, 'session is marked as logged in');
    t.same(
      calls,
      [{ username: { $eq: 'admin@snyk.io' }, password: { $eq: 'SuperSecretPassword' } }],
      'query pins both fields with $eq against string values'
    );
  });
  t.end();
});

tap.test('archive extraction cannot escape the target directory (Zip Slip)', (t) => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'goof-extract-'));
  const escapeTarget = path.join(os.tmpdir(), 'goof-zipslip-' + process.pid + '.txt');
  const traversalEntry = '../'.repeat(10) + path.basename(escapeTarget);

  const zip = new AdmZip();
  zip.addFile(traversalEntry, Buffer.from('pwned\n'));
  zip.addFile('harmless.txt', Buffer.from('ok\n'));

  try {
    new AdmZip(zip.toBuffer()).extractAllTo(target, true);
  } catch (err) {
    t.pass('extraction of a traversal entry was refused: ' + err.message);
  }

  t.notOk(fs.existsSync(escapeTarget), 'no file was written outside the extraction directory');
  fs.rmSync(target, { recursive: true, force: true });
  fs.rmSync(escapeTarget, { force: true });
  t.end();
});
