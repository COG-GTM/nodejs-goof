const test = require('node:test')
const assert = require('node:assert')
const crypto = require('crypto')
const security = require('../lib/security')
const renderMarkdown = require('../lib/markdown')

test('hashPassword/verifyPassword round trip', async () => {
  const secret = crypto.randomBytes(8).toString('hex')
  const stored = security.hashPassword(secret)
  assert.match(stored, /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/)
  assert.strictEqual(await security.verifyPassword(secret, stored), true)
  assert.strictEqual(await security.verifyPassword(secret + 'x', stored), false)
  assert.strictEqual(await security.verifyPassword(secret, secret), false)
  assert.strictEqual(await security.verifyPassword(secret, undefined), false)
})

test('safeRedirectPath only allows same-origin paths', () => {
  assert.strictEqual(security.safeRedirectPath('/admin', '/x'), '/admin')
  assert.strictEqual(security.safeRedirectPath('//evil.com', '/x'), '/x')
  assert.strictEqual(security.safeRedirectPath('/\\evil.com', '/x'), '/x')
  assert.strictEqual(security.safeRedirectPath('https://evil.com', '/x'), '/x')
  assert.strictEqual(security.safeRedirectPath('javascript:alert(1)', '/x'), '/x')
  assert.strictEqual(security.safeRedirectPath(['/admin'], '/x'), '/x')
})

test('isZip detects the zip local file header', () => {
  assert.strictEqual(security.isZip(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0])), true)
  assert.strictEqual(security.isZip(Buffer.from('hello')), false)
})

test('markdown escapes raw HTML and unsafe links', () => {
  const html = renderMarkdown('**hi** <img src=x onerror=alert(1)> [a](javascript:alert(1)) [b](https://snyk.io)')
  assert.match(html, /<strong>hi<\/strong>/)
  assert.doesNotMatch(html, /<img src=x/)
  assert.doesNotMatch(html, /javascript:/)
  assert.match(html, /href="https:\/\/snyk.io"/)
})

test('markdown keeps relative links and blocks obfuscated schemes', () => {
  const html = renderMarkdown('[a](docs/page.html) ![i](img/p.png) [b](JaVaScRiPt:alert(1)) [c](//evil.com) [d](/\\evil.com) [e](data:text/html,x) [f](javascript&colon;alert(1))')
  assert.match(html, /href="docs\/page.html"/)
  assert.match(html, /src="img\/p.png"/)
  assert.doesNotMatch(html, /(href|src)="(?!docs|img|#)/)
  assert.strictEqual((html.match(/href="#"/g) || []).length, 5)
})
