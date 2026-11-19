const test = require('node:test');
const assert = require('node:assert');
const _ = require('lodash');

test('lodash is at or above 4.17.19 (SNYK-JS-LODASH-567746 / CVE-2020-8203)', () => {
  const [major, minor, patch] = _.VERSION.split('.').map(Number);
  assert.ok(major > 4 || (major === 4 && (minor > 17 || (minor === 17 && patch >= 19))), _.VERSION);
});

test('_.merge on a chat message body does not pollute Object.prototype', () => {
  const body = JSON.parse('{"message":{"text":"hi","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted2":true}}}}');
  const message = { icon: '👋' };
  _.merge(message, body.message, { id: 1, timestamp: Date.now(), userName: 'admin' });
  assert.strictEqual({}.polluted, undefined);
  assert.strictEqual({}.polluted2, undefined);
  assert.strictEqual(message.text, 'hi');
});
