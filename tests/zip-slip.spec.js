var tap    = require('tap');
var fs     = require('fs');
var os     = require('os');
var path   = require('path');
var AdmZip = require('adm-zip');
var utils  = require('../utils');

// entries: ['../../usr/src/goof/public/about.html', 'backup.txt']
var maliciousZip = path.join(__dirname, '..', 'exploits', 'zip-slip', 'malicious_backup.zip');
var traversalTarget = path.join('usr', 'src', 'goof', 'public', 'about.html');

function tempDest() {
  var base = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-slip-'));
  var dest = path.join(base, 'a', 'b', 'extracted_files');
  // where the '../../' entry of malicious_backup.zip lands when unchecked
  return { base: base, dest: dest, escaped: path.resolve(dest, '..', '..', traversalTarget) };
}

tap.test('safe_extract_path rejects entries escaping the destination', function (t) {
  var root = '/tmp/extracted_files';

  t.equal(utils.safe_extract_path(root, '../../../../etc/cron.d/x'), null);
  t.equal(utils.safe_extract_path(root, 'a/../../outside.txt'), null);
  t.equal(utils.safe_extract_path(root, '/etc/passwd'), null);
  t.equal(utils.safe_extract_path(root, '..\\..\\outside.txt'), null);
  t.equal(utils.safe_extract_path(root, ''), null);
  t.equal(utils.safe_extract_path(root, 'backup.txt'), path.join(root, 'backup.txt'));
  t.equal(utils.safe_extract_path(root, 'dir/backup.txt'), path.join(root, 'dir', 'backup.txt'));
  t.end();
});

tap.test('safe_extract_zip writes safe entries and skips traversal entries', function (t) {
  var tmp     = tempDest();
  var escaped = tmp.escaped;

  var written = utils.safe_extract_zip(new AdmZip(maliciousZip), tmp.dest);

  t.ok(fs.existsSync(path.join(tmp.dest, 'backup.txt')), 'safe entry extracted');
  t.notOk(fs.existsSync(escaped), 'traversal entry must not be written outside the destination');
  t.equal(written.length, 1);

  fs.rmSync(tmp.base, { recursive: true, force: true });
  t.end();
});
