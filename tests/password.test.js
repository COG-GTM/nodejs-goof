var assert = require('assert');
var utils = require('../utils');

// Regression test for the hard-coded admin credentials finding (CWE-798):
// no static password may live in source, and stored credentials must be hashed.
var seed = require('fs').readFileSync(require('path').join(__dirname, '..', 'mongoose-db.js'), 'utf8');
assert.ok(!/SuperSecretPassword/.test(seed), 'seed must not contain a hard-coded password');
assert.ok(!/password:\s*'[^']+'/.test(seed), 'seed must not assign a literal password');

var hashed = utils.hash_password('correct horse battery staple');
assert.ok(hashed.indexOf('scrypt$') === 0, 'password must be stored as a scrypt hash');
assert.ok(hashed.indexOf('correct horse battery staple') === -1, 'plaintext must not be stored');
assert.notStrictEqual(hashed, utils.hash_password('correct horse battery staple'), 'hashes must be salted');

assert.strictEqual(utils.verify_password('correct horse battery staple', hashed), true);
assert.strictEqual(utils.verify_password('wrong password', hashed), false);

// NoSQL-injection style payloads and missing hashes must never authenticate.
assert.strictEqual(utils.verify_password({ $gt: '' }, hashed), false);
assert.strictEqual(utils.verify_password('anything', undefined), false);
assert.strictEqual(utils.verify_password('anything', ''), false);
assert.strictEqual(utils.verify_password('anything', 'SuperSecretPassword'), false);

var generated = utils.random_password();
assert.ok(generated.length >= 24, 'generated password must be long');
assert.notStrictEqual(generated, utils.random_password(), 'generated passwords must differ');

console.log('password hashing tests passed');
