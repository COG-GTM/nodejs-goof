// Run with: node tests/users.routes.test.js
var test = require('node:test')
var assert = require('node:assert')
var http = require('http')
var Module = require('module')
var express = require('express')
var bodyParser = require('body-parser')

var store = { Users: [], AuditLog: [] }
var nextId = { Users: 1, AuditLog: 1 }

function repository(name) {
  return {
    find: async function (opts) {
      return store[name].filter(function (row) { return row.id === opts.where.id })
    },
    save: async function (input) {
      var rows = Array.isArray(input) ? input : [input]
      var saved = rows.map(function (row) {
        var copy = Object.assign({ id: nextId[name]++ }, row)
        store[name].push(copy)
        return copy
      })
      return Array.isArray(input) ? saved : saved[0]
    }
  }
}

var connection = {
  getRepository: repository,
  transaction: async function (work) { return work({ getRepository: repository }) }
}

var originalLoad = Module._load
Module._load = function (request) {
  if (request === 'typeorm') {
    return { getConnection: function () { return connection } }
  }
  return originalLoad.apply(this, arguments)
}
var router = require('../routes/users.js')
Module._load = originalLoad

function buildApp(session) {
  var app = express()
  app.use(bodyParser.json())
  app.use(function (req, res, next) { req.session = session; next() })
  app.use('/users', router)
  return app
}

function request(app, method, body) {
  return new Promise(function (resolve, reject) {
    var server = app.listen(0, function () {
      var payload = body === undefined ? null : JSON.stringify(body)
      var req = http.request({
        port: server.address().port,
        path: '/users',
        method: method,
        headers: payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}
      }, function (res) {
        var chunks = ''
        res.on('data', function (c) { chunks += c })
        res.on('end', function () {
          server.close()
          resolve({ status: res.statusCode, body: chunks ? JSON.parse(chunks) : null })
        })
      })
      req.on('error', reject)
      if (payload) req.write(payload)
      req.end()
    })
  })
}

var admin = { loggedIn: 1, username: 'admin@snyk.io' }

test.beforeEach(function () {
  store.Users = [{ id: 1, name: 'Liran', address: 'IL', role: 'user' }]
  store.AuditLog = []
  nextId.Users = 2
  nextId.AuditLog = 1
})

test('rejects unauthenticated GET and POST', async function () {
  var app = buildApp({})
  assert.strictEqual((await request(app, 'GET')).status, 401)
  assert.strictEqual((await request(app, 'POST', { name: 'a', address: 'b' })).status, 401)
  assert.strictEqual(store.Users.length, 1)
  assert.strictEqual(store.AuditLog.length, 0)
})

test('GET returns the record and audits the read', async function () {
  var res = await request(buildApp(admin), 'GET')
  assert.strictEqual(res.status, 200)
  assert.deepStrictEqual(res.body, [{ id: 1, name: 'Liran', address: 'IL', role: 'user' }])
  assert.deepStrictEqual(store.AuditLog.map(function (a) { return [a.action, a.actor, a.targetUserId] }),
    [['user.read', 'admin@snyk.io', 1]])
})

test('POST rejects client-supplied role and unexpected fields', async function () {
  var app = buildApp(admin)
  assert.strictEqual((await request(app, 'POST', { name: 'a', address: 'b', role: 'admin' })).status, 400)
  assert.strictEqual((await request(app, 'POST', { name: 'a', address: 'b', isAdmin: true })).status, 400)
  assert.strictEqual((await request(app, 'POST', JSON.parse('{"name":"a","address":"b","__proto__":{"x":1}}'))).status, 400)
  assert.strictEqual(store.Users.length, 1)
})

test('POST validates name and address', async function () {
  var app = buildApp(admin)
  var bad = [{ address: 'b' }, { name: 'a', address: 42 }, { name: '  ', address: 'b' },
    { name: 'a'.repeat(101), address: 'b' }, { name: 'a\nb', address: 'b' }, ['a']]
  for (var i = 0; i < bad.length; i++) {
    assert.strictEqual((await request(app, 'POST', bad[i])).status, 400, JSON.stringify(bad[i]))
  }
  assert.strictEqual(store.Users.length, 1)
})

test('POST creates a user with the default role, audits it, and logs no personal data', async function () {
  var logged = []
  var originalLog = console.log
  console.log = function () { logged.push(Array.prototype.join.call(arguments, ' ')) }
  try {
    var res = await request(buildApp(admin), 'POST', { name: ' Jane ', address: '1 Main St' })
    assert.strictEqual(res.status, 201)
    assert.deepStrictEqual(res.body, { id: 2, role: 'user' })
  } finally {
    console.log = originalLog
  }
  assert.deepStrictEqual(store.Users[1], { id: 2, name: 'Jane', address: '1 Main St', role: 'user' })
  assert.deepStrictEqual(store.AuditLog.map(function (a) { return [a.action, a.actor, a.targetUserId, a.role] }), [
    ['user.created', 'admin@snyk.io', 2, null],
    ['user.role.assigned', 'admin@snyk.io', 2, 'user']
  ])
  assert.ok(logged.every(function (line) { return line.indexOf('Jane') === -1 && line.indexOf('Main St') === -1 }))
})
