var crypto = require('crypto');
var path = require('path');
var yauzl = require('yauzl');

var SCRYPT_KEYLEN = 64;

function hashPassword(password) {
  var salt = crypto.randomBytes(16).toString('hex');
  var hash = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex');
  return 'scrypt$' + salt + '$' + hash;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  var parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  var expected = Buffer.from(parts[2], 'hex');
  var actual = crypto.scryptSync(String(password), parts[1], expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// Only allow same-origin relative paths such as "/admin".
function safeRedirectPath(target, fallback) {
  if (typeof target === 'string' && /^\/(?![\/\\])/.test(target) && !/[\r\n]/.test(target)) {
    return target;
  }
  return fallback;
}

function isZip(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length >= 4 &&
    buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
}

// Reads a single entry from a zip held in memory without writing anything to disk.
function readZipEntry(buffer, entryName, maxBytes, callback) {
  yauzl.fromBuffer(buffer, { lazyEntries: true, strictFileNames: true }, function (err, zip) {
    if (err) return callback(err);
    var done = false;
    function finish(err, data) {
      if (done) return;
      done = true;
      zip.close();
      callback(err, data);
    }
    zip.on('error', finish);
    zip.on('end', function () { finish(null, null); });
    zip.on('entry', function (entry) {
      var name = path.posix.normalize(entry.fileName);
      if (name !== entryName) return zip.readEntry();
      if (entry.uncompressedSize > maxBytes) return finish(new Error('Zip entry too large'));
      zip.openReadStream(entry, function (err, stream) {
        if (err) return finish(err);
        var chunks = [];
        var size = 0;
        stream.on('data', function (chunk) {
          size += chunk.length;
          if (size > maxBytes) {
            stream.destroy();
            return finish(new Error('Zip entry too large'));
          }
          chunks.push(chunk);
        });
        stream.on('error', finish);
        stream.on('end', function () { finish(null, Buffer.concat(chunks)); });
      });
    });
    zip.readEntry();
  });
}

module.exports = {
  hashPassword: hashPassword,
  verifyPassword: verifyPassword,
  safeRedirectPath: safeRedirectPath,
  isZip: isZip,
  readZipEntry: readZipEntry
};
