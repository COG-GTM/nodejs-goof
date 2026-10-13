var test = require('tap').test;
var renderMarkdown = require('../../markdown');

var payloads = [
  '[xss](javascript&#58this;alert(1&#41;)',
  '[xss](javascript:alert(1))',
  '[xss](JaVaScRiPt:alert(1))',
  '[xss](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)',
  '![x](x"onerror="alert(1))',
  '<img src=x onerror=alert(1)>',
  '<script>alert(1)</script>',
  '<a href="javascript:alert(1)">x</a>'
];

test('SEC-09: rendered todo markdown cannot inject script', function (t) {
  payloads.forEach(function (payload) {
    var html = renderMarkdown(new String(payload));
    t.notMatch(html, /javascript:|javascript&#|data:text\/html/i, 'no script URL: ' + payload);
    t.notMatch(html, /<script|\son\w+\s*=/i, 'no script tag or event handler: ' + payload);
  });
  t.end();
});

test('SEC-09: benign markdown still renders', function (t) {
  t.equal(renderMarkdown(new String('**buy** milk')), '<p><strong>buy</strong> milk</p>\n');
  t.match(renderMarkdown('[docs](https://snyk.io)'), '<a href="https://snyk.io">docs</a>');
  t.match(renderMarkdown('![logo](https://snyk.io/logo.png)'), '<img src="https://snyk.io/logo.png" alt="logo" />');
  t.end();
});
