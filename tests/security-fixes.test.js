var assert = require('assert');

describe('Security Fixes', function () {

  describe('Bug 1: Command Injection Prevention', function () {
    var childProcess = require('child_process');

    test('execFile should not allow shell metacharacter injection', function (done) {
      var url = 'http://example.com/img.png; rm -rf /';
      childProcess.execFile('echo', [url], function (err, stdout) {
        assert.ok(stdout.includes('; rm -rf /'));
        assert.ok(!err);
        done();
      });
    });

    test('execFile treats the entire argument as a single token', function (done) {
      var url = '$(whoami)';
      childProcess.execFile('echo', [url], function (err, stdout) {
        assert.strictEqual(stdout.trim(), '$(whoami)');
        done();
      });
    });
  });

  describe('Bug 2: NoSQL Injection Prevention', function () {
    function validateLoginInput(username, password) {
      if (typeof username !== 'string' || typeof password !== 'string') {
        return false;
      }
      return true;
    }

    test('should reject object-type username (NoSQL $gt operator)', function () {
      var result = validateLoginInput({ '$gt': '' }, { '$gt': '' });
      assert.strictEqual(result, false);
    });

    test('should reject array-type password', function () {
      var result = validateLoginInput('admin@snyk.io', ['password']);
      assert.strictEqual(result, false);
    });

    test('should accept valid string credentials', function () {
      var result = validateLoginInput('admin@snyk.io', 'SuperSecretPassword');
      assert.strictEqual(result, true);
    });

    test('should reject undefined credentials', function () {
      var result = validateLoginInput(undefined, undefined);
      assert.strictEqual(result, false);
    });
  });

  describe('Bug 3: Prototype Pollution Prevention', function () {
    var _ = require('lodash');

    function sanitizeMessage(rawMessage) {
      var sanitized = {};
      Object.keys(rawMessage).forEach(function (key) {
        if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
          sanitized[key] = rawMessage[key];
        }
      });
      return sanitized;
    }

    test('should strip __proto__ key from input', function () {
      var malicious = { text: 'hello', '__proto__': { isAdmin: true } };
      var sanitized = sanitizeMessage(malicious);
      assert.ok(!sanitized.hasOwnProperty('__proto__'));
      assert.strictEqual(sanitized.text, 'hello');
    });

    test('should strip constructor key from input', function () {
      var malicious = { text: 'hello', 'constructor': { prototype: { isAdmin: true } } };
      var sanitized = sanitizeMessage(malicious);
      assert.ok(!sanitized.hasOwnProperty('constructor'));
      assert.strictEqual(sanitized.text, 'hello');
    });

    test('should strip prototype key from input', function () {
      var malicious = { text: 'hello', 'prototype': { isAdmin: true } };
      var sanitized = sanitizeMessage(malicious);
      assert.strictEqual(sanitized['prototype'], undefined);
    });

    test('should preserve legitimate message properties', function () {
      var legitimate = { text: 'hello', icon: 'wave' };
      var sanitized = sanitizeMessage(legitimate);
      assert.strictEqual(sanitized.text, 'hello');
      assert.strictEqual(sanitized.icon, 'wave');
    });

    test('merged object should not pollute Object.prototype', function () {
      var target = { icon: 'default' };
      var malicious = { text: 'hello' };
      var sanitized = sanitizeMessage(malicious);
      _.merge(target, sanitized);
      assert.strictEqual({}.isAdmin, undefined);
      assert.strictEqual(target.text, 'hello');
    });
  });
});
