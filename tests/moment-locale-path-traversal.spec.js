// Regression test for CVE-2022-24785 / SNYK-JS-MOMENT-2440688:
// moment.locale(<user input>) must not load files outside moment's locale directory.
const fs = require('fs');
const os = require('os');
const path = require('path');
const tap = require('tap');
const moment = require('moment');

function evilLocale(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moment-traversal-'));
  const flag = '__momentTraversal_' + path.basename(dir).replace(/\W/g, '_');
  const file = path.join(dir, 'evil.js');
  fs.writeFileSync(file, 'global[' + JSON.stringify(flag) + '] = true;\n');
  t.teardown(() => fs.rmSync(dir, { recursive: true, force: true }));
  const name = '../'.repeat(30) + file.replace(/^\/+/, '').replace(/\.js$/, '');
  return { name, loaded: () => Boolean(global[flag]) };
}

tap.test('string locale name with ../ is rejected', (t) => {
  const evil = evilLocale(t);
  const before = moment.locale();
  moment.locale(evil.name);
  t.notOk(evil.loaded(), 'file outside the locale directory was not required');
  t.equal(moment.locale(), before, 'locale is unchanged');
  t.end();
});
