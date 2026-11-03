var crypto = require('crypto');

function hashPassword(plain, cb) {
  var salt = crypto.randomBytes(16);
  crypto.scrypt(plain, salt, 64, function (err, derivedKey) {
    if (err) return cb(err);
    cb(null, 'scrypt$' + salt.toString('hex') + '$' + derivedKey.toString('hex'));
  });
}

function isHashed(stored) {
  return typeof stored === 'string'
    && /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/.test(stored);
}

function verifyPassword(plain, stored, cb) {
  if (typeof plain !== 'string' || plain.length === 0 || !isHashed(stored)) {
    return cb(null, false);
  }

  var parts = stored.split('$');
  var salt = Buffer.from(parts[1], 'hex');
  var expected = Buffer.from(parts[2], 'hex');
  crypto.scrypt(plain, salt, 64, function (err, derivedKey) {
    if (err) return cb(err);
    cb(null, crypto.timingSafeEqual(derivedKey, expected));
  });
}

module.exports = {
  hashPassword: hashPassword,
  isHashed: isHashed,
  verifyPassword: verifyPassword,
};
