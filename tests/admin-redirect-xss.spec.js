const path = require('path')
const tap = require('tap')
const express = require('express')
const ejsEngine = require('ejs-locals')

const utils = require('../utils')

function renderAdmin (redirectPage) {
  const app = express()
  app.engine('ejs', ejsEngine)
  app.set('views', path.join(__dirname, '..', 'views'))
  app.set('view engine', 'ejs')

  return new Promise(function (resolve, reject) {
    app.render('admin', {
      title: 'Admin Access',
      granted: false,
      redirectPage: redirectPage
    }, function (err, html) {
      if (err) return reject(err)
      resolve(html)
    })
  })
}

tap.test('safe_redirect_path allow-lists same-site relative paths', function (t) {
  t.equal(utils.safe_redirect_path('/admin'), '/admin')
  t.equal(utils.safe_redirect_path('/admin?x=1'), '/admin?x=1')
  t.equal(utils.safe_redirect_path('https://evil.example.com'), '')
  t.equal(utils.safe_redirect_path('//evil.example.com'), '')
  t.equal(utils.safe_redirect_path('javascript:alert(1)'), '')
  t.equal(utils.safe_redirect_path('/../etc/passwd'), '')
  t.equal(utils.safe_redirect_path('"><script>alert(1)</script>'), '')
  t.equal(utils.safe_redirect_path(undefined), '')
  t.equal(utils.safe_redirect_path(['/admin']), '')
  t.end()
})

tap.test('admin view does not reflect an XSS payload', function (t) {
  const payload = '"><script>alert(1)</script>'
  return renderAdmin(payload).then(function (html) {
    t.notMatch(html, /<script>alert\(1\)<\/script>/, 'template escapes even an unsanitized value')
    return renderAdmin(utils.safe_redirect_path(payload))
  }).then(function (html) {
    t.notMatch(html, /<script>alert\(1\)<\/script>/, 'payload is not injected as markup')
    t.match(html, /name="redirectPage" value=""/, 'unsafe redirect target is dropped')
  })
})

tap.test('admin view keeps a safe redirect target', function (t) {
  return renderAdmin(utils.safe_redirect_path('/admin')).then(function (html) {
    t.match(html, /name="redirectPage" value="\/admin"/)
  })
})
