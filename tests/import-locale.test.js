const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const moment = require('moment');
const utils = require('../utils');

test('accepts locales bundled with moment', () => {
  assert.strictEqual(utils.safeMomentLocale('en'), 'en');
  assert.strictEqual(utils.safeMomentLocale('fr'), 'fr');
  assert.strictEqual(utils.safeMomentLocale(' EN_GB '), 'en-gb');
});

test('rejects locale names outside the allow-list', () => {
  [
    '../../../../tmp/x',
    '../../../../../../tmp/extracted_files/evil',
    '/etc/passwd',
    'fr/../../../package',
    '..\\..\\x',
    'xx-not-a-locale',
    '',
    undefined,
    ['fr'],
  ].forEach((name) => {
    assert.strictEqual(utils.safeMomentLocale(name), null, String(name));
  });
});

test('a rejected traversal locale is never required', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'locale-'));
  const marker = path.join(dir, 'ran');
  fs.writeFileSync(
    path.join(dir, 'evil.js'),
    `require('fs').writeFileSync(${JSON.stringify(marker)}, '1');`
  );
  const traversal = path.relative(
    path.join(path.dirname(require.resolve('moment')), 'locale'),
    path.join(dir, 'evil')
  );

  assert.strictEqual(utils.safeMomentLocale(traversal), null);
  moment().locale(traversal);
  assert.strictEqual(fs.existsSync(marker), false);
});
