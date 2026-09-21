const { test } = require('node:test');
const assert = require('node:assert');
const { mockRes } = require('./helpers');
const routes = require('../routes');

test('POST /create rejects non-string content (mongoose Buffer memory exposure)', async () => {
  const res = mockRes();
  routes.create({ body: { content: 800 } }, res, assert.ifError);
  await res.finished;

  assert.strictEqual(res.statusCode, 400);
});

test('POST /create rejects objects as content', async () => {
  const res = mockRes();
  routes.create({ body: { content: { $gt: '' } } }, res, assert.ifError);
  await res.finished;

  assert.strictEqual(res.statusCode, 400);
});
