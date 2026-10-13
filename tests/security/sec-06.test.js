// SEC-06 regression: user passwords must be stored as bcrypt hashes and
// verified with bcrypt at login. Requires MongoDB (MONGODB_URI, default
// mongodb://localhost/goof-sec06-test); the test database is dropped.
const tap = require('tap');
const bcrypt = require('bcryptjs');
const MongoClient = require('mongodb').MongoClient;

process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost/goof-sec06-test';

const ADMIN = 'admin@snyk.io';
const ADMIN_PASSWORD = 'SuperSecretPassword';
const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$/;

let client, users, mongoose, User, routes;

function waitFor(fn, timeout = 10000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function poll() {
      Promise.resolve(fn()).then((v) => {
        if (v) return resolve(v);
        if (Date.now() - start > timeout) return reject(new Error('timed out'));
        setTimeout(poll, 100);
      }, reject);
    })();
  });
}

function login(username, password) {
  return new Promise((resolve) => {
    const req = { body: { username, password }, session: {} };
    const res = {
      status(code) { return { send: () => resolve({ status: code, session: req.session }) }; },
      redirect(location) { resolve({ status: 302, location, session: req.session }); },
    };
    routes.loginHandler(req, res);
  });
}

tap.test('setup: legacy plaintext admin exists before app start', async () => {
  client = await MongoClient.connect(process.env.MONGODB_URI, { useUnifiedTopology: true });
  const db = client.db();
  await db.dropDatabase();
  users = db.collection('users');
  await users.insertOne({ username: ADMIN, password: ADMIN_PASSWORD });
  await users.insertOne({ username: 'legacy@example.com', password: 'legacyPassword' });

  require('../../mongoose-db');
  mongoose = require('mongoose');
  User = mongoose.model('User');
  routes = require('../../routes');
});

tap.test('existing plaintext passwords are re-hashed on startup', async (t) => {
  const admin = await waitFor(async () => {
    const doc = await users.findOne({ username: ADMIN });
    return doc && BCRYPT_HASH.test(doc.password) && doc;
  });
  t.notEqual(admin.password, ADMIN_PASSWORD, 'password is not stored in plaintext');
  t.ok(bcrypt.compareSync(ADMIN_PASSWORD, admin.password), 'hash matches original password');
  t.equal(await users.countDocuments({ username: ADMIN }), 1, 'no duplicate admin created');
  const legacy = await waitFor(async () => {
    const doc = await users.findOne({ username: 'legacy@example.com' });
    return doc && BCRYPT_HASH.test(doc.password) && doc;
  });
  t.ok(bcrypt.compareSync('legacyPassword', legacy.password), 'non-admin legacy user re-hashed');
});

tap.test('new users are saved with a salted bcrypt hash', async (t) => {
  await new Promise((resolve, reject) =>
    new User({ username: 'a@example.com', password: 'samePassword' }).save((err) => (err ? reject(err) : resolve())));
  await new Promise((resolve, reject) =>
    new User({ username: 'b@example.com', password: 'samePassword' }).save((err) => (err ? reject(err) : resolve())));
  const a = await users.findOne({ username: 'a@example.com' });
  const b = await users.findOne({ username: 'b@example.com' });
  t.match(a.password, BCRYPT_HASH, 'stored as bcrypt hash');
  t.notEqual(a.password, 'samePassword');
  t.notEqual(a.password, b.password, 'hashes are salted');

  const hashLike = '$2a$10$' + 'x'.repeat(53);
  await new Promise((resolve, reject) =>
    new User({ username: 'c@example.com', password: hashLike }).save((err) => (err ? reject(err) : resolve())));
  const c = await users.findOne({ username: 'c@example.com' });
  t.notEqual(c.password, hashLike, 'bcrypt-looking passwords are still hashed');
  t.ok(bcrypt.compareSync(hashLike, c.password));
});

tap.test('login compares against the hash', async (t) => {
  const ok = await login(ADMIN, ADMIN_PASSWORD);
  t.equal(ok.status, 302, 'correct password logs in');
  t.equal(ok.location, '/admin');
  t.equal(ok.session.loggedIn, 1);

  t.equal((await login(ADMIN, 'wrong')).status, 401, 'wrong password rejected');

  const stored = (await users.findOne({ username: ADMIN })).password;
  t.equal((await login(ADMIN, stored)).status, 401, 'stored hash is not accepted as a password');
  t.equal((await login('nobody@example.com', ADMIN_PASSWORD)).status, 401, 'unknown user rejected');
  t.equal((await login('legacy@example.com', 'legacyPassword')).status, 302, 'migrated legacy user logs in');
});

tap.teardown(async () => {
  if (client) {
    await client.db().dropDatabase();
    await client.close();
  }
  if (mongoose) await mongoose.disconnect();
});
