var tap = require('tap');
var passwordHash = require('../password-hash');

tap.test('hashes with a random salt and verifies the original password', function (t) {
  passwordHash.hashPassword('correct horse', function (err, first) {
    t.error(err);
    t.ok(passwordHash.isHashed(first));
    t.notOk(first.indexOf('correct horse') >= 0);
    passwordHash.hashPassword('correct horse', function (err, second) {
      t.error(err);
      t.not(first, second);
      passwordHash.verifyPassword('correct horse', first, function (err, ok) {
        t.error(err);
        t.equal(ok, true);
        passwordHash.verifyPassword('wrong', first, function (err, ok) {
          t.error(err);
          t.equal(ok, false);
          t.end();
        });
      });
    });
  });
});

tap.test('rejects plaintext stored values and non-string input', function (t) {
  passwordHash.verifyPassword('SuperSecretPassword', 'SuperSecretPassword', function (err, ok) {
    t.error(err);
    t.equal(ok, false);
    passwordHash.verifyPassword({ $gt: '' }, 'scrypt$' + 'a'.repeat(32) + '$' + 'b'.repeat(128), function (err, ok) {
      t.error(err);
      t.equal(ok, false);
      passwordHash.verifyPassword('', undefined, function (err, ok) {
        t.error(err);
        t.equal(ok, false);
        t.end();
      });
    });
  });
});
