'use strict';

// Regression tests for NoSQL operator injection in POST /login.
// mongoose 4.2.4 cannot talk to a modern mongod, so the model is stubbed with an
// in-memory collection that implements the operator semantics the exploit relies on.
const path = require('path');
const tap = require('tap');

const users = [{ username: 'admin@snyk.io', password: 'SuperSecretPassword' }];

function matches(doc, query) {
  return Object.keys(query).every(function (key) {
    const condition = query[key];
    if (condition !== null && typeof condition === 'object') {
      if ('$eq' in condition) return doc[key] === condition.$eq;
      if ('$gt' in condition) return doc[key] > condition.$gt;
      if ('$ne' in condition) return doc[key] !== condition.$ne;
      throw new Error('unsupported operator: ' + JSON.stringify(condition));
    }
    return doc[key] === condition;
  });
}

const models = {
  Todo: { find: function () { return { sort: function () { return { exec: function () {} }; } }; } },
  User: {
    find: function (query, cb) {
      return cb(null, users.filter(function (doc) { return matches(doc, query); }));
    },
  },
};

require.cache[require.resolve('mongoose')] = {
  id: require.resolve('mongoose'),
  filename: require.resolve('mongoose'),
  loaded: true,
  exports: { model: function (name) { return models[name]; } },
};

const routes = require(path.join(__dirname, '..', 'routes'));

function login(body) {
  return new Promise(function (resolve) {
    const req = { body: body, session: {} };
    const res = {
      status: function (code) { this.statusCode = code; return this; },
      send: function () { resolve({ status: this.statusCode || 200, session: req.session }); },
      redirect: function (location) { resolve({ status: 302, location: location, session: req.session }); },
    };
    routes.loginHandler(req, res, function (err) { resolve({ error: err, session: req.session }); });
  });
}

tap.test('operator injection payloads cannot authenticate', function (t) {
  const payloads = [
    { $gt: '' },
    { $ne: null },
    { $ne: 'nope' },
    { $regex: '.*' },
    ['SuperSecretPassword'],
  ];

  return Promise.all(payloads.map(function (password) {
    return login({ username: 'admin@snyk.io', password: password }).then(function (result) {
      t.equal(result.status, 401, 'password ' + JSON.stringify(password) + ' is rejected');
      t.notOk(result.session.loggedIn, 'no session is established');
    });
  }));
});

tap.test('an object username cannot authenticate', function (t) {
  return login({ username: { $ne: null }, password: { $ne: null } }).then(function (result) {
    t.equal(result.status, 401);
    t.notOk(result.session.loggedIn);
  });
});

tap.test('a wrong password is rejected', function (t) {
  return login({ username: 'admin@snyk.io', password: 'wrong' }).then(function (result) {
    t.equal(result.status, 401);
    t.notOk(result.session.loggedIn);
  });
});

tap.test('valid credentials still authenticate', function (t) {
  return login({ username: 'admin@snyk.io', password: 'SuperSecretPassword' }).then(function (result) {
    t.equal(result.status, 302);
    t.equal(result.location, '/admin');
    t.equal(result.session.loggedIn, 1);
  });
});
