var crypto = require('crypto');

var SCHEME = 'scrypt';
var N = 16384;
var R = 8;
var P = 1;
var KEY_LENGTH = 64;
var SALT_BYTES = 16;
var MAX_PASSWORD_LENGTH = 1024;

function isHash(value) {
  return typeof value === 'string' && value.indexOf(SCHEME + '$') === 0 &&
    value.split('$').length === 6;
}

function derive(password, salt, n, r, p, keyLength, callback) {
  crypto.scrypt(password, salt, keyLength, { N: n, r: r, p: p, maxmem: 64 * 1024 * 1024 }, callback);
}

function hash(password, callback) {
  if (typeof password !== 'string' || password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
    return process.nextTick(callback, new Error('password must be a non-empty string'));
  }
  crypto.randomBytes(SALT_BYTES, function (err, salt) {
    if (err) return callback(err);
    derive(password, salt, N, R, P, KEY_LENGTH, function (err, key) {
      if (err) return callback(err);
      callback(null, [SCHEME, N, R, P, salt.toString('base64'), key.toString('base64')].join('$'));
    });
  });
}

function verify(password, stored, callback) {
  if (typeof password !== 'string' || password.length > MAX_PASSWORD_LENGTH || !isHash(stored)) {
    return process.nextTick(callback, null, false);
  }
  var parts = stored.split('$');
  var n = parseInt(parts[1], 10);
  var r = parseInt(parts[2], 10);
  var p = parseInt(parts[3], 10);
  var salt = Buffer.from(parts[4], 'base64');
  var expected = Buffer.from(parts[5], 'base64');
  if (!(n > 1 && r > 0 && p > 0) || salt.length === 0 || expected.length === 0) {
    return process.nextTick(callback, null, false);
  }
  derive(password, salt, n, r, p, expected.length, function (err, key) {
    if (err) return callback(err);
    callback(null, crypto.timingSafeEqual(key, expected));
  });
}

module.exports = {
  hash: hash,
  verify: verify,
  isHash: isHash,
};
