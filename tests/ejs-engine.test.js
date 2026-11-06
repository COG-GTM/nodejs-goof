const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const marked = require('marked');
const renderFile = require('../ejs-engine');

const views = path.join(__dirname, '..', 'views');

function render(view, locals) {
  return new Promise((resolve, reject) => {
    renderFile(path.join(views, view), locals, (err, html) => (err ? reject(err) : resolve(html)));
  });
}

test('wraps a view in the layout it selects', async () => {
  const html = await render('index.ejs', {
    title: 'Patch TODO List',
    marked,
    todos: [{ _id: 'abc123', content: 'buy **milk**' }],
  });
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<title>Patch TODO List<\/title>/);
  assert.match(html, /<div id="layout">\s*<style>/);
  assert.match(html, /<h1 id="page-title">Patch TODO List<\/h1>/);
  assert.match(html, /href="\/edit\/abc123"/);
  assert.match(html, /<strong>milk<\/strong>/);
  assert.doesNotMatch(html, /layout\(/);
});

test('escapes <%= %> output', async () => {
  const html = await render('edit.ejs', {
    title: '<script>x</script>',
    current: '1',
    todos: [{ _id: '1', content: '"><img src=x onerror=alert(1)>' }],
  });
  assert.match(html, /<title>&lt;script&gt;x&lt;\/script&gt;<\/title>/);
  assert.match(html, /value="&#34;&gt;&lt;img src=x onerror=alert\(1\)&gt;"/);
});

test('render data cannot inject code through compile options', async () => {
  const marker = path.join(os.tmpdir(), `ejs-engine-injected-${process.pid}`);
  const payload = `(process.mainModule.require('fs').writeFileSync(${JSON.stringify(marker)}, 'x'), null) || function (s) { return s; }`;
  try {
    await render('index.ejs', {
      title: 't',
      marked,
      todos: [],
      client: true,
      escape: payload,
      escapeFunction: payload,
      outputFunctionName: `x;process.mainModule.require('fs').writeFileSync(${JSON.stringify(marker)}, 'x');s`,
      settings: { 'view options': { client: true, escape: payload } },
    });
  } catch (err) {
    // A rejected option is fine; executing it is not.
  }
  assert.strictEqual(fs.existsSync(marker), false);
});
