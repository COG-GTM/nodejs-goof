const tap = require('tap');
const { seedAdmin, ADMIN_USERNAME } = require('../seed-admin');

function mockUserModel({ users = [], findError = null, saveError = null, saved = [] } = {}) {
  function UserModel(doc) {
    this.doc = doc;
  }

  UserModel.queries = [];
  UserModel.saved = saved;

  UserModel.find = function (query) {
    UserModel.queries.push(query);
    return {
      exec: function (cb) {
        cb(findError, findError ? null : users);
      },
    };
  };

  UserModel.prototype.save = function (cb) {
    if (saveError) {
      return cb(saveError);
    }
    UserModel.saved.push(this.doc);
    cb(null, this.doc, 1);
  };

  return UserModel;
}

tap.test('creates the admin account when it is missing', (t) => {
  const UserModel = mockUserModel({ users: [] });

  seedAdmin(UserModel, (err, created) => {
    t.error(err);
    t.equal(created, true);
    t.strictSame(UserModel.queries, [{ username: ADMIN_USERNAME }]);
    t.equal(UserModel.saved.length, 1);
    t.equal(UserModel.saved[0].username, ADMIN_USERNAME);
    t.ok(UserModel.saved[0].password);
    t.end();
  });
});

tap.test('does not create the admin account when it already exists', (t) => {
  const UserModel = mockUserModel({ users: [{ username: ADMIN_USERNAME }] });

  seedAdmin(UserModel, (err, created) => {
    t.error(err);
    t.equal(created, false);
    t.equal(UserModel.saved.length, 0);
    t.end();
  });
});

tap.test('reports lookup errors without saving', (t) => {
  const UserModel = mockUserModel({ findError: new Error('lookup failed') });

  seedAdmin(UserModel, (err, created) => {
    t.match(err.message, 'lookup failed');
    t.equal(created, false);
    t.equal(UserModel.saved.length, 0);
    t.end();
  });
});

tap.test('reports save errors', (t) => {
  const UserModel = mockUserModel({ users: [], saveError: new Error('save failed') });

  seedAdmin(UserModel, (err, created) => {
    t.match(err.message, 'save failed');
    t.equal(created, false);
    t.equal(UserModel.saved.length, 0);
    t.end();
  });
});

tap.test('works without a callback', (t) => {
  const UserModel = mockUserModel({ users: [] });

  t.doesNotThrow(() => seedAdmin(UserModel));
  t.equal(UserModel.saved.length, 1);
  t.end();
});
