const { test } = require('tap');
const utils = require('../utils');
const { fakeRes } = require('./helpers/stubs');

test('ran_no returns an integer within the inclusive range', (t) => {
  const samples = Array.from({ length: 100 }, () => utils.ran_no(3, 7));
  t.ok(samples.every(Number.isInteger), 'all samples are integers');
  t.ok(samples.every((n) => n >= 3 && n <= 7), 'all samples are within [3, 7]');
  t.equal(utils.ran_no(5, 5), 5);
  t.end();
});

test('uid returns a string of the requested length using the allowed alphabet', (t) => {
  const id = utils.uid(32);
  t.equal(id.length, 32);
  t.match(id, /^[A-Za-z0-9]+$/);
  t.equal(utils.uid(0), '');
  t.end();
});

test('forbidden writes a 403 plain text response', (t) => {
  const res = fakeRes();
  utils.forbidden(res);
  t.equal(res.statusCode, 403);
  t.equal(res.headers['Content-Type'], 'text/plain');
  t.equal(res.headers['Content-Length'], 'Forbidden'.length);
  t.equal(res.body, 'Forbidden');
  t.ok(res.ended);
  t.end();
});
