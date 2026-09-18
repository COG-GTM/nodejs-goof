const test = require('node:test')
const assert = require('node:assert')
const express = require('express')
const bodyParser = require('body-parser')
const typeorm = require('typeorm')

const usersRouter = require('../routes/users')

function startApp () {
  const app = express()
  app.use(bodyParser.json())
  app.use('/users', usersRouter)
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server))
  })
}

function stubConnection (repo) {
  const original = typeorm.getConnection
  typeorm.getConnection = () => ({ getRepository: () => repo })
  return () => { typeorm.getConnection = original }
}

async function withStub (repo, fn) {
  const restore = stubConnection(repo)
  const server = await startApp()
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  try {
    return await fn(baseUrl)
  } finally {
    restore()
    await new Promise((resolve) => server.close(resolve))
  }
}

test('GET /users returns the stored users and queries id 1', async () => {
  const users = [{ id: 1, name: 'Liran', address: 'IL', role: 'user' }]
  const calls = []

  await withStub({ find: async (criteria) => { calls.push(criteria); return users } }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/users`)
    assert.strictEqual(res.status, 200)
    assert.deepStrictEqual(await res.json(), users)
  })

  assert.deepStrictEqual(calls, [{ id: 1 }])
})

test('GET /users responds with 500 when the repository fails', async () => {
  await withStub({ find: async () => { throw new Error('mysql is down') } }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/users`)
    assert.strictEqual(res.status, 500)
  })
})

test('POST /users saves only name, address and role', async () => {
  const saved = []

  await withStub({ save: async (user) => { saved.push(user); return { id: 7, ...user } } }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Simon', address: 'UK', role: 'admin', id: 99 })
    })
    assert.strictEqual(res.status, 200)
  })

  assert.deepStrictEqual(saved, [{ name: 'Simon', address: 'UK', role: 'admin' }])
})

test('POST /users responds with 500 when saving fails', async () => {
  await withStub({ save: async () => { throw new Error('mysql is down') } }, async (baseUrl) => {
    const res = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Simon', address: 'UK', role: 'admin' })
    })
    assert.strictEqual(res.status, 500)
  })
})
