var http = require('http')
var path = require('path')
var tap = require('tap')
var express = require('express')
var bodyParser = require('body-parser')

var saved = []

// Stub typeorm before routes/users.js requires it so no database is needed.
var typeormPath = require.resolve('typeorm')
require.cache[typeormPath] = {
  id: typeormPath,
  filename: typeormPath,
  loaded: true,
  exports: {
    getConnection: function () {
      return {
        getRepository: function () {
          return {
            save: async function (user) {
              saved.push(user)
              return Object.assign({ id: saved.length }, user)
            },
            find: async function () {
              return []
            }
          }
        }
      }
    }
  }
}

var usersRouter = require(path.join(__dirname, '..', 'routes', 'users.js'))

function startServer (session) {
  var app = express()
  app.use(bodyParser.json())
  app.use(function (req, res, next) {
    req.session = session
    next()
  })
  app.use('/users', usersRouter)

  return new Promise(function (resolve) {
    var server = http.createServer(app).listen(0, function () {
      resolve(server)
    })
  })
}

async function postUser (session, body) {
  var server = await startServer(session)
  try {
    var res = await fetch('http://127.0.0.1:' + server.address().port + '/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
    return res
  } finally {
    server.close()
  }
}

tap.beforeEach(function (done) {
  saved = []
  done()
})

tap.test('anonymous requests cannot create users', async function (t) {
  var res = await postUser({}, { name: 'mallory', address: 'IL', role: 'admin' })

  t.equal(res.status, 401)
  t.same(saved, [])
  t.end()
})

tap.test('role from the request body is ignored', async function (t) {
  var res = await postUser({ loggedIn: 1 }, { name: 'mallory', address: 'IL', role: 'admin' })

  t.equal(res.status, 200)
  t.equal(saved.length, 1)
  t.equal(saved[0].role, 'user')
  t.equal(saved[0].name, 'mallory')
  t.equal(saved[0].address, 'IL')
  t.end()
})

tap.test('only allowlisted fields are persisted', async function (t) {
  var res = await postUser({ loggedIn: 1 }, { name: 'liran', address: 'IL', id: 1, isAdmin: true })

  t.equal(res.status, 200)
  t.same(Object.keys(saved[0]).sort(), ['address', 'name', 'role'])
  t.end()
})

tap.test('non-string name or address is rejected', async function (t) {
  var res = await postUser({ loggedIn: 1 }, { name: { $ne: null }, address: 'IL' })

  t.equal(res.status, 400)
  t.same(saved, [])
  t.end()
})

tap.test('role is taken from the server-side session', async function (t) {
  var res = await postUser({ loggedIn: 1, role: 'admin' }, { name: 'simon', address: 'UK', role: 'user' })

  t.equal(res.status, 200)
  t.equal(saved[0].role, 'admin')
  t.end()
})
