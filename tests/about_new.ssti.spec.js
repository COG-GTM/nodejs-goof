// Regression test for SSTI via the `device` query parameter on GET /about_new.
// Run with: node tests/about_new.ssti.spec.js
const assert = require('assert');
const path = require('path');
const cons = require('consolidate');
const dust = require('dustjs-linkedin');
const dustHelpers = require('dustjs-helpers');
const mongoose = require('mongoose');

cons.dust.helpers = dustHelpers;
dust.helpers = dustHelpers;

// routes/index.js resolves these models at require time; register them without a DB connection.
mongoose.model('Todo', new mongoose.Schema({}, { strict: false }));
mongoose.model('User', new mongoose.Schema({}, { strict: false }));

const routes = require('../routes/index');
const template = path.join(__dirname, '..', 'views', 'about_new.dust');

function render(device, cb) {
  const captured = {};
  const req = { query: { device } };
  const res = {
    render: function (view, locals) {
      captured.locals = locals;
      cons.dust(template, locals, function (err, html) {
        if (err) return cb(err);
        cb(null, html, locals);
      });
    },
  };
  routes.about_new(req, res, function (err) { cb(err || new Error('next() called')); });
}

const sentinel = path.join(__dirname, 'ssti-marker.txt');
const payload =
  "'-global.process.mainModule.require('fs').writeFileSync('" + sentinel + "','pwned')-'";

render(payload, function (err, html, locals) {
  assert.ifError(err);
  assert.strictEqual(locals.device, 'Unknown', 'unknown device must be normalized');
  assert.strictEqual(locals.isDesktop, false);
  assert.ok(!require('fs').existsSync(sentinel), 'payload must not execute server-side');
  assert.ok(html.indexOf('require(') === -1, 'payload must not be reflected as code');
  assert.ok(html.indexOf('font-size: x-large') !== -1, 'non-desktop styling expected');

  render('Desktop', function (err2, htmlDesktop, desktopLocals) {
    assert.ifError(err2);
    assert.strictEqual(desktopLocals.isDesktop, true);
    assert.ok(htmlDesktop.indexOf('font-size: medium') !== -1);

    render({ toString: function () { return 'Desktop'; } }, function (err3, _h, objLocals) {
      assert.ifError(err3);
      assert.strictEqual(objLocals.device, 'Unknown', 'non-string device must be rejected');
      console.log('about_new SSTI regression tests passed');
    });
  });
});
