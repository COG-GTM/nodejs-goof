const t = require('tap')
const mongoose = require('mongoose')

mongoose.model('Todo', new mongoose.Schema({ content: Buffer, updated_at: Date }))
const User = mongoose.model('User', new mongoose.Schema({ username: String, password: String }))
User.find = (query, cb) => cb(null, [{ username: query.username }])

const routes = require('../../routes')

function login (redirectPage) {
  return new Promise((resolve) => {
    const req = {
      body: { username: 'admin@snyk.io', password: 'SuperSecretPassword', redirectPage },
      session: {}
    }
    const res = {
      redirect: (url) => resolve(url),
      status: () => res,
      send: () => resolve(null)
    }
    routes.loginHandler(req, res)
  })
}

t.test('local redirect targets are preserved', async (t) => {
  t.equal(await login(undefined), '/admin')
  t.equal(await login(''), '/admin')
  t.equal(await login('/admin'), '/admin')
  t.equal(await login('/todo?id=1#top'), '/todo?id=1#top')
})

t.test('external redirect targets fall back to /admin', async (t) => {
  const payloads = [
    'https://evil.example.com',
    'http://evil.example.com/admin',
    '//evil.example.com',
    '/\\evil.example.com',
    '\\\\evil.example.com',
    '/\t/evil.example.com',
    '/.//evil.example.com',
    'javascript:alert(1)',
    ['//evil.example.com'],
    { href: '//evil.example.com' }
  ]
  for (const payload of payloads) {
    t.equal(await login(payload), '/admin', `blocks ${JSON.stringify(payload)}`)
  }
})
