const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');

const payloads = [
  ['__proto__.polluted', String],
  ['constructor.prototype.polluted', String],
];

for (const [path, type] of payloads) {
  test(`Schema.path() rejects ${path}`, () => {
    assert.throws(() => new mongoose.Schema({}).path(path, type));
    assert.strictEqual({}.polluted, undefined);
  });
}

test('Schema() ignores __proto__ in a parsed definition', () => {
  new mongoose.Schema(JSON.parse('{"__proto__":{"polluted":"HACKED"}}'));
  assert.strictEqual({}.polluted, undefined);
});
