const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { parseImageUrl, identifyImage } = require('../routes/image-identify');

const hosts = ['images.example.com'];
const imgRegex = /\!\[alt text\]\((http.*)\s\".*/;

function capture(content) {
  return content.match(imgRegex)[1];
}

test('accepts allowlisted http(s) image urls', () => {
  assert.strictEqual(parseImageUrl('https://images.example.com/a.png', hosts), 'https://images.example.com/a.png');
  assert.strictEqual(parseImageUrl('http://IMAGES.example.com/a.png', hosts), 'http://images.example.com/a.png');
});

test('rejects non-allowlisted hosts, other protocols and credentials', () => {
  assert.strictEqual(parseImageUrl('http://169.254.169.254/latest/meta-data', hosts), null);
  assert.strictEqual(parseImageUrl('http://localhost/a.png', hosts), null);
  assert.strictEqual(parseImageUrl('httpx://images.example.com/a.png', hosts), null);
  assert.strictEqual(parseImageUrl('http://u:p@images.example.com/a.png', hosts), null);
  assert.strictEqual(parseImageUrl('http://x;touch /tmp/injected', hosts), null);
  assert.strictEqual(parseImageUrl('https://images.example.com/a.png', []), null);
});

test('never passes request data to a shell', () => {
  const calls = [];
  const execFile = (...args) => calls.push(args);
  const payload = capture('![alt text](https://images.example.com/a.png;touch /tmp/injected "t")');
  identifyImage(payload, { hosts, execFile });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0][0], 'identify');
  assert.deepStrictEqual(calls[0][1], ['https://images.example.com/a.png;touch%20/tmp/injected']);

  identifyImage(capture('![alt text](http://x;touch /tmp/injected "t")'), { hosts, execFile });
  assert.strictEqual(calls.length, 1);
});

test('injection payload does not execute when identify really runs', async () => {
  const marker = path.join('/tmp', 'injected-' + process.pid);
  try { fs.unlinkSync(marker); } catch (e) {}
  const childProcess = require('child_process');
  await new Promise((resolve) => {
    const execFile = (cmd, args, opts, cb) =>
      childProcess.execFile(cmd, args, opts, (...r) => { cb(...r); resolve(); });
    const ran = identifyImage(capture('![alt text](http://127.0.0.1:1/a.png;touch ' + marker + ' "t")'), { hosts: ['127.0.0.1'], execFile });
    if (!ran) resolve();
  });
  assert.strictEqual(fs.existsSync(marker), false);
});

test('routes/index.js does not use child_process.exec', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'index.js'), 'utf8');
  assert.ok(!/child_process'\)\.exec\b/.test(src));
  assert.ok(!/require\(['"]child_process['"]\)/.test(src));
});
