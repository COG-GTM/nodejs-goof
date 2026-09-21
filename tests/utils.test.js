var t = require('tap');
var utils = require('../utils');

t.test('parse leaves a todo without a reminder untouched', function (t) {
  t.equal(utils.parse('buy milk'), 'buy milk');
  t.end();
});

t.test('parse turns a trailing duration into a humanized suffix', function (t) {
  t.equal(utils.parse('call mom in 2 hours'), 'call mom [2h]');
  t.end();
});

t.test('parse strips a trailing newline from the duration', function (t) {
  t.equal(utils.parse('call mom in 2 hours\n'), 'call mom [2h]');
  t.end();
});

t.test('parse drops an unparsable duration and keeps the text', function (t) {
  t.equal(utils.parse('call mom in a while'), 'call mom');
  t.end();
});

t.test('parse ignores a reminder token at position zero', function (t) {
  t.equal(utils.parse(' in 2 hours'), ' in 2 hours');
  t.end();
});

t.test('isBlank', function (t) {
  t.ok(utils.isBlank(''));
  t.ok(utils.isBlank('   '));
  t.ok(utils.isBlank(undefined));
  t.notOk(utils.isBlank('a'));
  t.end();
});
