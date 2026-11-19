const test = require('node:test')
const assert = require('node:assert')
const mongoose = require('mongoose')

mongoose.model('Todo', new mongoose.Schema({}))
const User = mongoose.model('User', new mongoose.Schema({ username: String, password: String }))

let findCalls = []
User.find = function (query, cb) {
  findCalls.push(query)
  cb(null, [{ username: 'admin@snyk.io' }])
}

const { loginHandler } = require('../routes')

function login(body) {
  findCalls = []
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this },
      send() { resolve(this) },
      redirect(location) { this.location = location; resolve(this) },
    }
    loginHandler({ body, session: {} }, res)
  })
}

test('rejects an operator object as password without querying the database', async () => {
  const res = await login({ username: 'admin@snyk.io', password: { $gt: '' } })
  assert.strictEqual(res.statusCode, 401)
  assert.strictEqual(findCalls.length, 0)
})

test('rejects an operator object as username without querying the database', async () => {
  const res = await login({ username: { $gt: '' }, password: 'x' })
  assert.strictEqual(res.statusCode, 401)
  assert.strictEqual(findCalls.length, 0)
})

test('still queries with string credentials', async () => {
  const res = await login({ username: 'admin@snyk.io', password: 'SuperSecretPassword' })
  assert.strictEqual(res.location, '/admin')
  assert.deepStrictEqual(findCalls, [{ username: 'admin@snyk.io', password: 'SuperSecretPassword' }])
})
