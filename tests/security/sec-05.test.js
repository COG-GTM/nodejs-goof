const path = require('path')
const http = require('http')
const tap = require('tap')
const express = require('express')
const bodyParser = require('body-parser')
const hbs = require('hbs')
const mongoose = require('mongoose')

// routes/index.js looks up these models at require time; stub them so the
// test doesn't need a MongoDB connection.
mongoose.model('Todo', new mongoose.Schema({}))
mongoose.model('User', new mongoose.Schema({}))
const routes = require('../../routes')

const validProfile = {
  firstname: 'Jane',
  lastname: 'Doe',
  country: 'IL',
  phone: '0501234567',
  email: 'jane@example.com'
}

function post (server, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = http.request({
      port: server.address().port,
      method: 'POST',
      path: '/account_details',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let out = ''
      res.on('data', (c) => { out += c })
      res.on('end', () => resolve({ status: res.statusCode, body: out }))
    })
    req.on('error', reject)
    req.end(data)
  })
}

tap.test('save_account_details only passes profile fields to the view', (t) => {
  let locals
  const req = { body: Object.assign({ layout: './../package.json', settings: {} }, validProfile) }
  const res = { render: (view, opts) => { locals = opts } }
  routes.save_account_details(req, res)
  t.same(Object.keys(locals).sort(), ['country', 'email', 'firstname', 'lastname', 'phone'])
  t.notOk('layout' in locals, 'layout from request body is dropped')
  t.equal(locals.firstname, 'Jane')
  t.end()
})

tap.test('POST /account_details ignores an injected layout', (t) => {
  const app = express()
  app.set('views', path.join(__dirname, '../../views'))
  app.set('etag', false)
  app.engine('hbs', hbs.__express)
  app.use(bodyParser.json())
  app.post('/account_details', routes.save_account_details)
  const server = app.listen(0, () => {
    post(server, Object.assign({ layout: './../package.json' }, validProfile))
      .then((res) => {
        t.equal(res.status, 200)
        t.notMatch(res.body, /"name": "goof"/, 'package.json is not rendered')
        t.match(res.body, /Account details for: Jane/, 'account view is rendered')
      })
      .catch(t.threw)
      .then(() => server.close(() => t.end()))
  })
})
