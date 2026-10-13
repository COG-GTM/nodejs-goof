const tap = require('tap')
const mongoose = require('mongoose')

mongoose.model('Todo', new mongoose.Schema({ content: Buffer, updated_at: Date }))
const User = mongoose.model('User', new mongoose.Schema({ username: String, password: String }))

const routes = require('../../routes')

// Simulates MongoDB: a query matches the admin user when every field is either
// an exact string match or an operator object (e.g. {"$gt": ""}) that would match.
const admin = { username: 'admin@snyk.io', password: 'SuperSecretPassword' }
let queries
User.find = function (query, cb) {
  queries.push(query)
  const matches = Object.keys(query).every((k) =>
    typeof query[k] === 'object' ? true : query[k] === admin[k])
  process.nextTick(() => cb(null, matches ? [admin] : []))
}

function login (body) {
  queries = []
  return new Promise((resolve) => {
    const res = {
      status (code) { this.statusCode = code; return this },
      send () { resolve({ status: this.statusCode }) },
      redirect (url) { resolve({ status: 302, location: url }) }
    }
    routes.loginHandler({ body, session: {} }, res, (err) => resolve({ status: 500, err }))
  })
}

tap.test('rejects operator object as password', async (t) => {
  const r = await login({ username: 'admin@snyk.io', password: { $gt: '' } })
  t.equal(r.status, 401)
  t.equal(queries.length, 0, 'no database query is made')
})

tap.test('rejects operator object as username', async (t) => {
  const r = await login({ username: { $gt: '' }, password: 'x' })
  t.equal(r.status, 401)
  t.equal(queries.length, 0, 'no database query is made')
})

tap.test('rejects wrong password', async (t) => {
  const r = await login({ username: 'admin@snyk.io', password: 'wrong' })
  t.equal(r.status, 401)
})

tap.test('accepts correct credentials', async (t) => {
  const r = await login({ username: 'admin@snyk.io', password: 'SuperSecretPassword' })
  t.equal(r.status, 302)
  t.equal(r.location, '/admin')
  t.same(queries, [{ username: 'admin@snyk.io', password: 'SuperSecretPassword' }])
})
