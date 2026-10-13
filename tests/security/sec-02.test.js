var tap = require('tap');
var fs = require('fs');
var os = require('os');
var path = require('path');
var mongoose = require('mongoose');

mongoose.model('Todo', new mongoose.Schema({ content: Buffer, updated_at: Date }));
mongoose.model('User', new mongoose.Schema({ username: String, password: String }));
mongoose.model('Todo').prototype.save = function (cb) { cb(null, this, 1); };

var routes = require('../../routes');

function fakeRes(done) {
  return {
    setHeader: function () {},
    status: function () { return this; },
    send: function () { done(); },
  };
}

tap.test('SEC-02: image URL in todo content is not passed to a shell', function (t) {
  var marker = path.join(os.tmpdir(), 'sec-02-pwned-' + process.pid);
  try { fs.unlinkSync(marker); } catch (e) {}

  var req = { body: { content: '![alt text](http://x.png;touch ' + marker + ' "a")' } };
  routes.create(req, fakeRes(function () {
    setTimeout(function () {
      t.notOk(fs.existsSync(marker), 'injected shell command must not run');
      try { fs.unlinkSync(marker); } catch (e) {}
      t.end();
    }, 1000);
  }), t.fail);
});
