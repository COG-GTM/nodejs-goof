var fs = require('fs');
var path = require('path');
var test = require('tap').test;

test('no hard-coded API token is defined or logged in app.js', function (t) {
  var app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  t.notMatch(app, /SECRET_TOKEN/, 'no token literal in app.js');
  t.notMatch(app, /token\s*=\s*['"`]/, 'no token assigned from a literal');
  t.notMatch(app, /console\.log\([^)]*token/i, 'no token written to the log');
  t.end();
});
