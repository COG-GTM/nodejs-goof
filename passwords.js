var crypto = require('crypto');

// scrypt parameters (OWASP Password Storage Cheat Sheet minimum: N=2^17, r=8, p=1)
var PREFIX = 'scrypt';
var N = 131072;
var R = 8;
var P = 1;
var KEY_LENGTH = 64;
var SALT_BYTES = 16;

function scryptOptions(n, r, p) {
  return { N: n, r: r, p: p, maxmem: 256 * n * r };
}

function isHashed(stored) {
  return typeof stored === 'string' && stored.indexOf(PREFIX + '$') === 0;
}

function hash(password, cb) {
  if (typeof password !== 'string' || password.length === 0) {
    return cb(new Error('password must be a non-empty string'));
  }
  var salt = crypto.randomBytes(SALT_BYTES);
  crypto.scrypt(password, salt, KEY_LENGTH, scryptOptions(N, R, P), function (err, derived) {
    if (err) return cb(err);
    cb(null, [PREFIX, N, R, P, salt.toString('base64'), derived.toString('base64')].join('$'));
  });
}

function verify(password, stored, cb) {
  if (typeof password !== 'string' || !isHashed(stored)) {
    return cb(null, false);
  }
  var parts = stored.split('$');
  if (parts.length !== 6) {
    return cb(null, false);
  }
  var n = parseInt(parts[1], 10);
  var r = parseInt(parts[2], 10);
  var p = parseInt(parts[3], 10);
  var salt = Buffer.from(parts[4], 'base64');
  var expected = Buffer.from(parts[5], 'base64');
  crypto.scrypt(password, salt, expected.length, scryptOptions(n, r, p), function (err, derived) {
    if (err) return cb(err);
    cb(null, crypto.timingSafeEqual(derived, expected));
  });
}

module.exports = {
  hash: hash,
  verify: verify,
  isHashed: isHashed,
};
