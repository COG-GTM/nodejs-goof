const tap = require('tap')
const mongoose = require('mongoose')

mongoose.model('Todo', new mongoose.Schema({}))
mongoose.model('User', new mongoose.Schema({}))

const routes = require('../routes')

tap.test('save_account_details renders only validated account fields', t => {
  let captured
  const req = {
    body: {
      email: 'a@b.com',
      phone: '0501234567',
      firstname: 'Bob  ',
      lastname: 'Smith',
      country: 'IL',
      layout: '../package.json',
      settings: {},
      foo: 'x'
    }
  }
  const res = {
    render: (view, opts) => {
      captured = { view, opts }
    }
  }

  routes.save_account_details(req, res)

  t.equal(captured.view, 'account.hbs')
  t.same(Object.keys(captured.opts).sort(), ['country', 'email', 'firstname', 'lastname', 'phone'])
  t.equal(captured.opts.layout, undefined)
  t.equal(captured.opts.firstname, 'Bob')
  t.end()
})

tap.test('save_account_details omits render options for invalid input', t => {
  let captured
  const req = {
    body: {
      email: 'not-an-email',
      phone: '0501234567',
      firstname: 'Bob',
      lastname: 'Smith',
      country: 'IL',
      layout: '../package.json'
    }
  }
  const res = {
    render: (view, opts) => {
      captured = { view, opts }
    }
  }

  routes.save_account_details(req, res)

  t.equal(captured.view, 'account.hbs')
  t.equal(captured.opts, undefined)
  t.end()
})

tap.test('save_account_details rejects non-string fields without throwing', t => {
  let captured
  const req = {
    body: {
      email: ['a@b.com'],
      phone: '0501234567',
      firstname: 'Bob',
      lastname: 'Smith',
      country: 'IL'
    }
  }
  const res = {
    render: (view, opts) => {
      captured = { view, opts }
    }
  }

  t.doesNotThrow(() => routes.save_account_details(req, res))
  t.equal(captured.view, 'account.hbs')
  t.equal(captured.opts, undefined)
  t.end()
})
