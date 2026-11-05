// Run with: node --test tests/users.routes.test.js
const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert')
const express = require('express')
const session = require('express-session')
const bodyParser = require('body-parser')
const typeorm = require('typeorm')

let saved = []
typeorm.getConnection = () => ({
  getRepository: () => ({
    find: async () => [{ id: 1, name: 'Liran', address: 'IL', role: 'user' }],
    save: async (user) => { saved.push(user); return Object.assign({ id: saved.length }, user) }
  })
})

const usersRouter = require('../routes/users')

let server
let baseUrl

before(async () => {
  const app = express()
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }))
  app.use(bodyParser.json())
  app.post('/test-login', (req, res) => {
    req.session.loggedIn = 1
    req.session.role = req.body.role
    res.sendStatus(204)
  })
  app.use('/users', usersRouter)
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve) })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(() => server.close())
beforeEach(() => { saved = [] })

async function login(role) {
  const res = await fetch(`${baseUrl}/test-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role })
  })
  return res.headers.get('set-cookie').split(';')[0]
}

function postUser(body, cookie) {
  const headers = { 'content-type': 'application/json' }
  if (cookie) headers.cookie = cookie
  return fetch(`${baseUrl}/users`, { method: 'POST', headers, body: JSON.stringify(body) })
}

test('anonymous POST /users returns 401 and saves nothing', async () => {
  const res = await postUser({ name: 'm', address: 'x', role: 'admin' })
  assert.strictEqual(res.status, 401)
  assert.deepStrictEqual(saved, [])
})

test('anonymous GET /users returns 401', async () => {
  const res = await fetch(`${baseUrl}/users`)
  assert.strictEqual(res.status, 401)
})

test('authenticated GET /users returns the record', async () => {
  const res = await fetch(`${baseUrl}/users`, { headers: { cookie: await login('user') } })
  assert.strictEqual(res.status, 200)
  assert.strictEqual((await res.json())[0].name, 'Liran')
})

test('normal user requesting role=admin gets role user', async () => {
  const res = await postUser({ name: 'm', address: 'x', role: 'admin' }, await login('user'))
  assert.strictEqual(res.status, 200)
  assert.deepStrictEqual(saved, [{ name: 'm', address: 'x', role: 'user' }])
})

test('role defaults to user when omitted', async () => {
  await postUser({ name: 'n', address: 'y' }, await login('admin'))
  assert.strictEqual(saved[0].role, 'user')
})

test('admin may assign the admin role', async () => {
  await postUser({ name: 'a', address: 'z', role: 'admin' }, await login('admin'))
  assert.strictEqual(saved[0].role, 'admin')
})

test('admin cannot assign an unknown role', async () => {
  await postUser({ name: 'a', address: 'z', role: 'superuser' }, await login('admin'))
  assert.strictEqual(saved[0].role, 'user')
})
