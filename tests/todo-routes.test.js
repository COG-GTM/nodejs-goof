var fs = require('fs');
var path = require('path');
var t = require('tap');

var models = require('./helpers/models');
var http = require('./helpers/http');
var routes = require('../routes');

var Todo = models.Todo;
var EXTRACTED_BACKUP = '/tmp/extracted_files/backup.txt';
var ZIP_WITH_BACKUP = path.join(__dirname, '..', 'exploits', 'zip-slip', 'my_backup.zip');
var ZIP_WITHOUT_BACKUP = path.join(__dirname, 'fixtures', 'no-backup.zip');

var saved = [];
var removed = [];
var found = {};

Todo.prototype.save = function (cb) {
  saved.push(this);
  cb(null, this, saved.length);
};

Todo.prototype.remove = function (cb) {
  removed.push(this);
  cb(null, this);
};

Todo.findById = function (id, cb) {
  cb(null, Object.prototype.hasOwnProperty.call(found, id) ? found[id] : null);
};

t.beforeEach(function (done) {
  saved = [];
  removed = [];
  found = {};
  try {
    fs.unlinkSync(EXTRACTED_BACKUP);
  } catch (e) {
  }
  done();
});

function contents() {
  return saved.map(function (todo) {
    return todo.content.toString();
  });
}

function uploadOf(file) {
  return http.fakeReq({ files: { importFile: { data: fs.readFileSync(file) } } });
}

t.test('create stores the todo and answers 302 with the base64 content', function (t) {
  var res = http.fakeRes();
  routes.create(http.fakeReq({ body: { content: 'buy milk' } }), res, t.threw);

  return res.whenEnded.then(function () {
    t.strictSame(contents(), ['buy milk']);
    t.equal(res.statusCode, 302);
    t.equal(res.headers.Location, '/');
    t.equal(res.body, Buffer.from('buy milk').toString('base64'));
  });
});

t.test('create expands a reminder into a humanized duration', function (t) {
  var res = http.fakeRes();
  routes.create(http.fakeReq({ body: { content: 'call mom in 2 hours' } }), res, t.threw);

  return res.whenEnded.then(function () {
    t.strictSame(contents(), ['call mom [2h]']);
  });
});

t.test('import without files reports that nothing was uploaded', function (t) {
  var res = http.fakeRes();
  routes.import(http.fakeReq(), res, t.threw);

  t.equal(res.body, 'No files were uploaded.');
  t.equal(saved.length, 0);
  t.end();
});

t.test('import of a text file creates one todo per non-blank line', function (t) {
  var res = http.fakeRes();
  var body = 'a\nb,2020-01-01,en,YYYY\n\n';
  routes.import(http.fakeReq({ files: { importFile: { data: Buffer.from(body) } } }), res, t.threw);

  t.equal(res.redirectedTo, '/');
  return http.waitFor(function () {
    return saved.length === 2;
  }).then(function () {
    t.strictSame(contents(), ['a', 'b [2020]']);
  });
});

t.test('import of a zip file imports the extracted backup.txt', function (t) {
  routes.import(uploadOf(ZIP_WITH_BACKUP), http.fakeRes(), t.threw);

  return http.waitFor(function () {
    return saved.length === 4;
  }).then(function () {
    t.strictSame(contents(), [
      'Buy some food',
      'Call mom',
      'Add details to the web page',
      'Check inbox for new mails',
    ]);
  });
});

t.test('import of a zip file without a backup.txt imports the fallback line', function (t) {
  routes.import(uploadOf(ZIP_WITHOUT_BACKUP), http.fakeRes(), t.threw);

  return http.waitFor(function () {
    return saved.length === 1;
  }).then(function () {
    t.strictSame(contents(), ['No backup.txt file found']);
  });
});

t.test('update rewrites the content of an existing todo', function (t) {
  found.abc = new Todo({ content: 'old', updated_at: Date.now() });
  var res = http.fakeRes();

  routes.update(http.fakeReq({ params: { id: 'abc' }, body: { content: 'new' } }), res, t.threw);

  return res.whenEnded.then(function () {
    t.strictSame(contents(), ['new']);
    t.equal(res.redirectedTo, '/');
  });
});

t.test('update of an unknown todo answers 404 instead of throwing', function (t) {
  var res = http.fakeRes();

  routes.update(http.fakeReq({ params: { id: 'nope' }, body: { content: 'new' } }), res, t.threw);

  return res.whenEnded.then(function () {
    t.equal(res.statusCode, 404);
    t.equal(saved.length, 0);
  });
});

t.test('destroy removes an existing todo', function (t) {
  found.abc = new Todo({ content: 'old', updated_at: Date.now() });
  var res = http.fakeRes();

  routes.destroy(http.fakeReq({ params: { id: 'abc' } }), res, t.threw);

  return res.whenEnded.then(function () {
    t.equal(removed.length, 1);
    t.equal(res.redirectedTo, '/');
  });
});

t.test('destroy of an unknown todo answers 404 instead of hanging', function (t) {
  var res = http.fakeRes();

  routes.destroy(http.fakeReq({ params: { id: 'nope' } }), res, t.threw);

  return res.whenEnded.then(function () {
    t.equal(res.statusCode, 404);
    t.equal(removed.length, 0);
  });
});
