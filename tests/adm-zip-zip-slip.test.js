const fs = require('fs');
const os = require('os');
const path = require('path');
const tap = require('tap');
const AdmZip = require('adm-zip');

function listFiles(dir) {
  return fs.readdirSync(dir).reduce(function (files, name) {
    const full = path.join(dir, name);
    return files.concat(fs.statSync(full).isDirectory() ? listFiles(full) : [full]);
  }, []);
}

tap.test('adm-zip extractAllTo keeps traversal entries inside the target (Zip Slip)', function (t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-slip-'));
  const target = path.join(root, 'a', 'b');
  fs.mkdirSync(target, { recursive: true });

  const zip = AdmZip(fs.readFileSync(path.join(__dirname, 'fixtures', 'zip-slip.zip')));
  zip.extractAllTo(target, true);

  const files = listFiles(root);
  files.forEach(function (file) {
    t.ok(file.startsWith(target + path.sep), file + ' is inside the extraction target');
  });
  t.equal(files.length, 5, 'all entries were extracted');
  t.notOk(fs.existsSync('/tmp/zip-slip-absolute.txt'), 'absolute entry not written to /tmp');

  fs.rmSync(root, { recursive: true, force: true });
  t.end();
});
