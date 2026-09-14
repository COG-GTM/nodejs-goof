const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

function installedVersion(pkg) {
  const file = path.join(__dirname, '..', 'node_modules', pkg, 'package.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')).version;
}

function atLeast(version, minimum) {
  const a = version.split('.').map(Number);
  const b = minimum.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return true;
}

// Minimum versions that close the advisories exploited by this app.
const MINIMUMS = {
  lodash: '4.17.21',          // CVE-2018-3721 / CVE-2019-10744 / CVE-2020-8203 prototype pollution in merge
  typeorm: '0.3.31',          // CVE-2020-8158 prototype pollution -> SQL injection in find/save/update
  mongoose: '8.0.0',          // CVE-2019-17426 / CVE-2022-2564 prototype pollution, Buffer memory exposure, search injection
  express: '4.22.0',          // open redirect / XSS via res.redirect, vulnerable qs and path-to-regexp
  'body-parser': '1.20.4',    // urlencoded DoS
  qs: '6.14.0',               // prototype pollution via bracket notation
  'dustjs-linkedin': '3.0.0', // prototype pollution in dust core (<3.0.0)
};

for (const [pkg, minimum] of Object.entries(MINIMUMS)) {
  test(`${pkg} is at least ${minimum}`, () => {
    const version = installedVersion(pkg);
    assert.ok(atLeast(version, minimum), `${pkg}@${version} is below the patched version ${minimum}`);
  });
}

test('the lodash in use is not vulnerable to prototype pollution through merge', () => {
  const _ = require('lodash');
  const target = {};
  _.merge(target, JSON.parse('{"__proto__":{"polluted":true}}'));
  _.merge(target, JSON.parse('{"constructor":{"prototype":{"polluted2":true}}}'));
  assert.strictEqual({}.polluted, undefined);
  assert.strictEqual({}.polluted2, undefined);
});

test('dustjs-helpers (eval-based @if) and the unused mongodb driver are no longer direct dependencies', () => {
  const pkg = require('../package.json');
  assert.strictEqual(pkg.dependencies['dustjs-helpers'], undefined);
  assert.strictEqual(pkg.dependencies.mongodb, undefined);
});
