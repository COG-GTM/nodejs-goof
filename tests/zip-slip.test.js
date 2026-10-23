var tap = require('tap');
var fs = require('fs');
var os = require('os');
var path = require('path');
var AdmZip = require('adm-zip');
var utils = require('../utils');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'goof-zip-'));
}

function zipWith(entryName, content) {
  var zip = new AdmZip();
  zip.addFile('placeholder.txt', Buffer.from(content));
  zip.getEntries()[0].entryName = entryName;
  return new AdmZip(zip.toBuffer());
}

tap.test('extracts a benign archive inside the target directory', function (t) {
  var target = tmpDir();
  var zip = new AdmZip(path.join(__dirname, '../exploits/zip-slip/my_backup.zip'));
  utils.safeExtractZip(zip, target);
  t.ok(fs.existsSync(path.join(target, 'backup.txt')));
  t.end();
});

tap.test('rejects the bundled zip-slip exploit archive without writing anything', function (t) {
  var target = tmpDir();
  var zip = new AdmZip(path.join(__dirname, '../exploits/zip-slip/malicious_backup.zip'));
  t.throws(function () { utils.safeExtractZip(zip, target); }, /Unsafe zip entry path/);
  t.same(fs.readdirSync(target), []);
  t.end();
});

tap.test('rejects traversal and absolute entry names', function (t) {
  var parent = tmpDir();
  var target = path.join(parent, 'out');
  fs.mkdirSync(target);
  [
    '../escaped.txt',
    'a/../../escaped.txt',
    '..\\escaped.txt',
    '/tmp/escaped.txt',
    'C:\\escaped.txt'
  ].forEach(function (name) {
    var zip = zipWith(name, 'pwned');
    t.equal(zip.getEntries()[0].entryName, name, 'fixture keeps raw name ' + name);
    t.throws(function () { utils.safeExtractZip(zip, target); }, /Unsafe zip entry path/, name);
  });
  t.notOk(fs.existsSync(path.join(parent, 'escaped.txt')));
  t.same(fs.readdirSync(target), []);
  t.end();
});

tap.test('rejects entries that would be written through an existing symlink', function (t) {
  var parent = tmpDir();
  var outside = path.join(parent, 'outside');
  var target = path.join(parent, 'out');
  fs.mkdirSync(outside);
  fs.mkdirSync(target);
  fs.symlinkSync(outside, path.join(target, 'link'));
  fs.symlinkSync(path.join(outside, 'victim.txt'), path.join(target, 'file-link.txt'));

  ['link/escaped.txt', 'file-link.txt'].forEach(function (name) {
    t.throws(function () { utils.safeExtractZip(zipWith(name, 'pwned'), target); }, /Unsafe zip entry path/, name);
  });
  t.same(fs.readdirSync(outside), []);
  t.end();
});

tap.test('rejects an extraction directory that is itself a symlink', function (t) {
  var parent = tmpDir();
  var outside = path.join(parent, 'outside');
  var target = path.join(parent, 'out');
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, target);
  t.throws(function () { utils.safeExtractZip(zipWith('backup.txt', 'pwned'), target); }, /is a symlink/);
  t.same(fs.readdirSync(outside), []);
  t.end();
});
