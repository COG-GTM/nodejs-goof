var test = require('tap').test;
var renderMarkdown = require('../safe-markdown');

var XSS_PAYLOADS = [
  '[Gotcha](javascript:alert(1))',
  '[Gotcha](javascript&#58;alert(1&#41;)',
  // The bypass demonstrated by exploits/marked-exploit.sh
  '[Gotcha](javascript&#58this;alert(1&#41;)',
  '[Gotcha](javascript&#X3a;alert(1))',
  '[Gotcha](java\tscript:alert(1))',
  '[Gotcha](JaVaScRiPt:alert(1))',
  '[Gotcha](vbscript:msgbox(1))',
  '[Gotcha](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
  '[Gotcha](" onclick="alert(1))',
  '![x](javascript&#58this;alert(1&#41;)',
  '![x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<bar"onclick="alert(1)"@foo>',
  '<a href="javascript:alert(1)">x</a>',
  '</a><svg onload=alert(1)>',
];

var ALLOWED_TAGS = ['p', 'a', 'img', 'em', 'strong', 'code', 'pre', 'br', 'hr', 'ul', 'ol', 'li',
  'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'del', 'table', 'thead', 'tbody', 'tr', 'th', 'td'];

function tagsOf(html) {
  return html.match(/<[^>]*>/g) || [];
}

test('markdown rendering cannot emit script bearing markup', function (t) {
  XSS_PAYLOADS.forEach(function (payload) {
    var html = renderMarkdown(payload);

    tagsOf(html).forEach(function (tag) {
      var name = tag.replace(/^<\/?\s*/, '').split(/[\s>/]/)[0].toLowerCase();
      t.ok(ALLOWED_TAGS.indexOf(name) !== -1, 'tag ' + tag + ' allowed for ' + payload);
      t.notMatch(tag, /\son[a-zA-Z]+\s*=/, 'no event handler in ' + tag + ' for ' + payload);
      t.notMatch(tag, /(href|src)\s*=\s*"[^"]*(javascript|vbscript|data)/i, 'no dangerous url in ' + tag);
      t.notMatch(tag, /&#?\w+;?\s*(:|this)/, 'no entity encoded scheme in ' + tag);
    });
  });
  t.end();
});

test('safe markdown keeps working', function (t) {
  t.match(renderMarkdown('This is **markdown**'), /<strong>markdown<\/strong>/);
  t.match(renderMarkdown('[Snyk](https://snyk.io/)'), /<a href="https:\/\/snyk\.io\/">Snyk<\/a>/);
  t.match(renderMarkdown('[mail](mailto:hello@snyk.io)'), /<a href="mailto:hello@snyk\.io">mail<\/a>/);
  t.match(renderMarkdown('[rel](/edit/1)'), /<a href="\/edit\/1">rel<\/a>/);
  t.match(renderMarkdown('![alt text](https://snyk.io/logo.png)'), /<img src="https:\/\/snyk\.io\/logo\.png" alt="alt text">/);
  t.match(renderMarkdown('a & b < c'), /a &amp; b &lt; c/);
  t.equal(renderMarkdown(undefined), '');
  t.end();
});

test('rejected links keep their text', function (t) {
  t.match(renderMarkdown('[Gotcha](javascript:alert(1))'), /Gotcha/);
  t.end();
});
