'use strict';

// SEC-10: static file serving must not allow directory traversal (st 0.2.4),
// and ms / humanize-ms must not be vulnerable to ReDoS.
// Run with: npx tap tests/security/sec-10.test.js

var path = require('path');
var http = require('http');
var tap = require('tap');

var root = path.join(__dirname, '..', '..');

// Stub the DB bootstrap modules so app.js can load without MongoDB/MySQL.
function stubModule(file, exportsValue) {
  var filename = require.resolve(path.join(root, file));
  require.cache[filename] = {
    id: filename,
    filename: filename,
    loaded: true,
    exports: exportsValue
  };
}

var mongoose = require('mongoose');
mongoose.model('Todo', new mongoose.Schema({ content: Buffer, updated_at: Date }));
mongoose.model('User', new mongoose.Schema({ username: String, password: String }));
stubModule('mongoose-db.js', {});
stubModule('typeorm-db.js', {});

// Capture the server app.js creates and bind it to a random free port.
var server;
var origCreateServer = http.createServer;
http.createServer = function () {
  server = origCreateServer.apply(http, arguments);
  return server;
};
process.env.PORT = '0';
require(path.join(root, 'app.js'));
http.createServer = origCreateServer;

function get(urlPath) {
  return new Promise(function (resolve, reject) {
    http.get({ host: '127.0.0.1', port: server.address().port, path: urlPath }, function (res) {
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function (chunk) { body += chunk; });
      res.on('end', function () { resolve({ status: res.statusCode, body: body }); });
    }).on('error', reject);
  });
}

tap.test('static serving', function (t) {
  t.teardown(function () { server.close(); });

  function run() {
    return get('/public/about.html').then(function (res) {
      t.equal(res.status, 200, 'legitimate static file is still served');
      t.match(res.body, /BESTest todo app/);
      return get('/public/%2e%2e/package.json');
    }).then(function (res) {
      t.notEqual(res.status, 200, 'encoded ../ to app root is rejected');
      t.notMatch(res.body, /"name": "goof"/, 'package.json is not leaked');
      return get('/public/%2e%2e/%2e%2e/%2E%2E/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/%2e%2e/etc/passwd');
    }).then(function (res) {
      t.notEqual(res.status, 200, 'encoded ../ to /etc/passwd is rejected');
      t.notMatch(res.body, /root:/, '/etc/passwd is not leaked');
    });
  }

  if (server.listening) return run();
  return new Promise(function (resolve) { server.once('listening', resolve); }).then(run);
});

tap.test('ms / humanize-ms are not vulnerable to ReDoS', function (t) {
  var ms = require('ms');
  var hms = require('humanize-ms');

  t.equal(hms('20 minutes'), 20 * 60 * 1000, 'humanize-ms still parses durations');
  t.equal(ms(20 * 60 * 1000), '20m', 'ms still formats durations');

  var payload = Array(60001).join('5') + ' minutea';
  var warn = console.warn;
  console.warn = function () {}; // humanize-ms logs the (huge) invalid input
  var start = Date.now();
  try {
    hms(payload);
    ms(payload);
  } finally {
    console.warn = warn;
  }
  var elapsed = Date.now() - start;
  t.ok(elapsed < 1000, 'long non-matching input parsed in ' + elapsed + 'ms');
  t.end();
});
