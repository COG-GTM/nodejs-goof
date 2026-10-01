var tap = require('tap');
var mongoose = require('mongoose');
var passwordHash = require('../password-hash');

var store = [
  { _id: new mongoose.Types.ObjectId(), username: 'legacy@example.com', password: 'plain-legacy', __v: 0 },
];

function matches(doc, cond) {
  return Object.keys(cond).every(function (key) {
    return String(doc[key]) === String(cond[key]);
  });
}

mongoose.connect = function () {};
var originalFind = mongoose.Model.find;
mongoose.Model.find = function (cond) {
  var Model = this;
  return {
    exec: function (cb) {
      setImmediate(function () {
        cb(null, store.filter(function (doc) { return matches(doc, cond || {}); }).map(function (doc) {
          return Model.hydrate(JSON.parse(JSON.stringify(doc)));
        }));
      });
    },
  };
};
mongoose.Model.findOne = function (cond, cb) {
  var Model = this;
  setImmediate(function () {
    var doc = store.filter(function (d) { return matches(d, cond); })[0];
    cb(null, doc ? Model.hydrate(JSON.parse(JSON.stringify(doc))) : null);
  });
};

process.env.GOOF_ADMIN_PASSWORD = 'Test-Admin-Pw-123';
require('../mongoose-db');
var User = mongoose.model('User');
User.collection.insert = function (obj, opts, cb) {
  store.push(JSON.parse(JSON.stringify(obj)));
  cb(null);
};
User.collection.update = function (cond, delta, opts, cb) {
  var doc = store.filter(function (d) { return String(d._id) === String(cond._id); })[0];
  Object.keys(delta.$set || {}).forEach(function (key) { doc[key] = delta.$set[key]; });
  cb(null, 1);
};

var routes = require('../routes');

function waitFor(predicate, cb) {
  var started = Date.now();
  (function poll() {
    if (predicate()) return cb();
    if (Date.now() - started > 5000) return cb(new Error('timed out'));
    setTimeout(poll, 20);
  })();
}

function login(username, password, cb) {
  var res = {
    statusCode: 200,
    status: function (code) { this.statusCode = code; return this; },
    send: function () { cb(this.statusCode); },
    redirect: function (location) { cb(302, location); },
  };
  routes.loginHandler({ body: { username: username, password: password }, session: {} }, res, function (err) {
    cb(500, err);
  });
}

tap.test('password-hash produces salted scrypt hashes and verifies them', function (t) {
  passwordHash.hash('correct horse', function (err, first) {
    t.error(err);
    passwordHash.hash('correct horse', function (err, second) {
      t.error(err);
      t.ok(passwordHash.isHash(first));
      t.notEqual(first, second, 'per-user random salt');
      t.notOk(first.indexOf('correct horse') >= 0);
      passwordHash.verify('correct horse', first, function (err, ok) {
        t.error(err);
        t.ok(ok);
        passwordHash.verify('wrong', first, function (err, ok) {
          t.error(err);
          t.notOk(ok);
          passwordHash.verify({ $gt: '' }, first, function (err, ok) {
            t.error(err);
            t.notOk(ok, 'non-string password rejected');
            passwordHash.verify('correct horse', 'correct horse', function (err, ok) {
              t.error(err);
              t.notOk(ok, 'plaintext stored value never matches');
              t.end();
            });
          });
        });
      });
    });
  });
});

tap.test('startup hashes legacy plaintext passwords and seeds a hashed admin', function (t) {
  waitFor(function () {
    return store.length === 2 && store.every(function (d) { return passwordHash.isHash(d.password); });
  }, function (err) {
    t.error(err);
    t.notOk(JSON.stringify(store).indexOf('plain-legacy') >= 0);
    t.notOk(JSON.stringify(store).indexOf('Test-Admin-Pw-123') >= 0);
    t.end();
  });
});

tap.test('login verifies against the stored hash', function (t) {
  login('admin@snyk.io', 'Test-Admin-Pw-123', function (status, location) {
    t.equal(status, 302);
    t.equal(location, '/admin');
    login('legacy@example.com', 'plain-legacy', function (status) {
      t.equal(status, 302, 'migrated legacy user can still log in');
      login('admin@snyk.io', 'wrong', function (status) {
        t.equal(status, 401);
        login('admin@snyk.io', { $gt: '' }, function (status) {
          t.equal(status, 401);
          login('nobody@snyk.io', 'Test-Admin-Pw-123', function (status) {
            t.equal(status, 401);
            mongoose.Model.find = originalFind;
            t.end();
          });
        });
      });
    });
  });
});
