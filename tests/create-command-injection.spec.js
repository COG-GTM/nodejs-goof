var test = require('tap').test;
var path = require('path');
var mongoose = require('mongoose');
var childProcess = require('child_process');

var spawned = [];
childProcess.exec = function () {
  spawned.push({ api: 'exec', args: Array.prototype.slice.call(arguments, 0, 1) });
};
childProcess.execFile = function (file, args, cb) {
  spawned.push({ api: 'execFile', file: file, args: args });
  if (cb) cb(null, '', '');
};

if (!mongoose.models.Todo) {
  mongoose.model('Todo', new mongoose.Schema({ content: String, updated_at: Date }));
}
if (!mongoose.models.User) {
  mongoose.model('User', new mongoose.Schema({ username: String, password: String }));
}
mongoose.Model.prototype.save = function (cb) {
  cb(null, { content: Buffer.from(String(this.content || '')) }, 1);
};

var routes = require(path.join(__dirname, '..', 'routes', 'index.js'));

function submit(content) {
  spawned = [];
  var res = { setHeader: function () {}, status: function () { return this; }, send: function () {} };
  routes.create({ body: { content: content } }, res, function (err) { throw err; });
  return spawned;
}

var injections = [
  '![alt text](http://x/;id ")',
  '![alt text](http://x/`id` ")',
  '![alt text](http://x/$(id) ")',
  '![alt text](http://x/|id ")',
  '![alt text](http://x/ && touch /tmp/pwn ")',
  '![alt text](http://x/\nid ")',
  '![alt text](file:///etc/passwd ")',
];

test('POST /create never invokes a shell for todo image urls', function (t) {
  injections.forEach(function (content) {
    var calls = submit(content);
    t.equal(calls.filter(function (c) { return c.api === 'exec'; }).length, 0,
      'no shell for ' + JSON.stringify(content));
    t.equal(calls.length, 0, 'no child process at all for ' + JSON.stringify(content));
  });
  t.end();
});

test('POST /create still inspects a well-formed image url without a shell', function (t) {
  var calls = submit('![alt text](http://example.com/snyk.png "logo")');
  t.equal(calls.length, 1, 'one child process');
  t.equal(calls[0].api, 'execFile', 'uses execFile');
  t.equal(calls[0].file, 'identify', 'runs identify');
  t.same(calls[0].args, ['http://example.com/snyk.png'], 'url passed as a single argument');
  t.end();
});
