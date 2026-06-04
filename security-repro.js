/*
 * Self-contained PoC for two Snyk Code findings in routes/index.js:
 *   - javascript/NoSqli (NoSQL Injection) in loginHandler  (line 39)
 *   - javascript/OR     (Open Redirect)   in adminLoginSuccess (line 61)
 *
 * No MongoDB and no running server: we register dummy mongoose models so the
 * route module loads, then stub User.find and a fake Express res object to
 * observe what reaches the sink.
 *
 * Run: node security-repro.js
 */
var assert = require('assert');
var mongoose = require('mongoose');

// Register the models routes/index.js expects, WITHOUT connecting to MongoDB.
mongoose.model('Todo', new mongoose.Schema({}, { strict: false }));
mongoose.model('User', new mongoose.Schema({}, { strict: false }));

var routes = require('./routes');
var User = mongoose.model('User');

function fakeRes() {
  return {
    statusCode: null,
    redirectedTo: undefined,
    status: function (c) { this.statusCode = c; return this; },
    send: function () { return this; },
    redirect: function (url) { this.redirectedTo = url; return this; },
  };
}

var results = [];

// Runtime-generated benign credential (avoids hardcoded-password literals).
var pw = String(Date.now());

// ---------------------------------------------------------------------------
// 1) NoSQL Injection: a non-string password object flows into User.find()
// ---------------------------------------------------------------------------
(function testNoSqlInjection() {
  var capturedQuery = null;
  // Stub the Mongoose static so no DB is needed; capture the query object.
  User.find = function (query, cb) {
    capturedQuery = query;
    // Pretend the operator-injection matched a user so login "succeeds".
    return cb(null, [{ username: query.username }]);
  };

  var req = {
    body: {
      username: 'admin@example.com',          // passes validator.isEmail
      password: { $gt: '' },                  // NoSQL operator injection
      redirectPage: '/admin',
    },
    session: {},
  };

  routes.loginHandler(req, fakeRes(), function () {});

  var passwordIsObject =
    capturedQuery &&
    typeof capturedQuery.password === 'object' &&
    capturedQuery.password !== null &&
    Object.prototype.hasOwnProperty.call(capturedQuery.password, '$gt');

  results.push({
    name: 'NoSQL Injection (loginHandler)',
    vulnerable: !!passwordIsObject,
    detail: 'query.password reaching User.find = ' + JSON.stringify(capturedQuery && capturedQuery.password),
  });
})();

// ---------------------------------------------------------------------------
// 2) Open Redirect: attacker-controlled redirectPage flows into res.redirect()
// ---------------------------------------------------------------------------
(function testOpenRedirect() {
  // Stub find so the login path succeeds and reaches adminLoginSuccess.
  User.find = function (query, cb) { return cb(null, [{ username: query.username }]); };

  var evil = 'https://evil.example/phish';
  var req = {
    body: {
      username: 'admin@example.com',
      password: pw,
      redirectPage: evil,
    },
    session: {},
  };
  var res = fakeRes();

  routes.loginHandler(req, res, function () {});

  results.push({
    name: 'Open Redirect (adminLoginSuccess) - absolute URL',
    vulnerable: res.redirectedTo === evil,
    detail: 'res.redirect() target = ' + JSON.stringify(res.redirectedTo),
  });

  // protocol-relative bypass: //evil.example
  var res2 = fakeRes();
  routes.loginHandler({ body: { username: 'admin@example.com', password: pw, redirectPage: '//evil.example' }, session: {} }, res2, function () {});
  results.push({
    name: 'Open Redirect (adminLoginSuccess) - protocol-relative',
    vulnerable: res2.redirectedTo === '//evil.example',
    detail: 'res.redirect() target = ' + JSON.stringify(res2.redirectedTo),
  });

  // sanity: a legitimate local relative redirect must still work after the fix
  var res3 = fakeRes();
  routes.loginHandler({ body: { username: 'admin@example.com', password: pw, redirectPage: '/admin/dashboard' }, session: {} }, res3, function () {});
  console.log('\n[sanity] legitimate relative redirect "/admin/dashboard" -> ' + JSON.stringify(res3.redirectedTo) +
    ' (expected "/admin/dashboard")');
})();

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
var anyVulnerable = false;
console.log('\n=== Snyk finding PoC results ===');
results.forEach(function (r) {
  console.log('- ' + r.name);
  console.log('    ' + r.detail);
  console.log('    VULNERABLE: ' + r.vulnerable);
  if (r.vulnerable) anyVulnerable = true;
});

// Exit code semantics:
//   BEFORE fix -> both vulnerable -> exit 1 (demonstrates the bugs)
//   AFTER  fix -> none vulnerable -> exit 0 (demonstrates remediation)
process.exit(anyVulnerable ? 1 : 0);
