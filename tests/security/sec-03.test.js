var tap = require('tap');
var fs = require('fs');
var os = require('os');
var path = require('path');
var mongoose = require('mongoose');
var AdmZip = require('adm-zip');

mongoose.model('Todo', new mongoose.Schema({ content: Buffer, updated_at: Date }));
mongoose.model('User', new mongoose.Schema({ username: String, password: String }));
var routes = require('../../routes');

function mockRes() {
  var res = { statusCode: 200 };
  res.status = function (code) { res.statusCode = code; return res; };
  res.send = function (body) { res.body = body; return res; };
  res.redirect = function (url) { res.redirectedTo = url; return res; };
  return res;
}

// adm-zip 0.4.7 can only serialize entries whose CRC32 fits in a signed int32 on modern Node,
// so the fixture contents below are fixed strings known to satisfy that.
function importZip(zip) {
  var res = mockRes();
  routes.import({ files: { importFile: { data: zip.toBuffer() } } }, res, function () {});
  return res;
}

tap.test('rejects zip entries that traverse outside the extraction directory', function (t) {
  var escapeName = 'sec03-' + process.pid + '-' + Date.now() + '.txt';
  var escapedPath = path.join(os.tmpdir(), escapeName);
  var zip = new AdmZip();
  zip.addFile('../' + escapeName, Buffer.from('zip slip payload'));

  var res = importZip(zip);

  t.equal(res.statusCode, 400);
  t.match(res.body, /Invalid zip file/);
  t.notOk(res.redirectedTo);
  t.notOk(fs.existsSync(escapedPath), 'file must not be written outside /tmp/extracted_files');
  if (fs.existsSync(escapedPath)) fs.unlinkSync(escapedPath);
  t.end();
});

tap.test('still extracts benign zip archives', function (t) {
  var name = 'sec03-ok-' + process.pid + '-' + Date.now() + '.txt';
  var zip = new AdmZip();
  zip.addFile(name, Buffer.from('buy milk'));

  var res = importZip(zip);

  var extracted = path.join('/tmp/extracted_files', name);
  t.equal(res.statusCode, 200);
  t.equal(res.redirectedTo, '/');
  t.ok(fs.existsSync(extracted), 'benign entry extracted inside /tmp/extracted_files');
  if (fs.existsSync(extracted)) fs.unlinkSync(extracted);
  t.end();
});
