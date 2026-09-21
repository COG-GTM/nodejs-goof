const tap = require('tap')
const mongoose = require('mongoose')

// routes/index.js resolves these models at require time; register the same
// schemas as mongoose-db.js so no database connection is needed.
mongoose.model('Todo', new mongoose.Schema({ content: Buffer, updated_at: Date }))
mongoose.model('User', new mongoose.Schema({ username: String, password: String }))

const routes = require('../routes')

const validProfile = {
  email: 'Display Name <user@example.com>',
  phone: '0501234567',
  firstname: 'John  ',
  lastname: 'Doe  ',
  country: 'Israel',
}

function render(profile) {
  const calls = []
  const res = {
    render: function (view, locals) {
      calls.push({ view: view, locals: locals })
    },
  }
  routes.save_account_details({ body: profile }, res)
  return calls
}

function profileWith(overrides) {
  return Object.assign({}, validProfile, overrides)
}

tap.test('accepts a valid profile and right-trims the names', function (t) {
  const calls = render(profileWith({}))

  t.equal(calls.length, 1)
  t.equal(calls[0].view, 'account.hbs')
  t.match(calls[0].locals, {
    email: 'Display Name <user@example.com>',
    phone: '0501234567',
    firstname: 'John',
    lastname: 'Doe',
    country: 'Israel',
  })
  t.end()
})

tap.test('accepts an email without a display name', function (t) {
  const calls = render(profileWith({ email: 'user@example.com' }))

  t.equal(calls[0].locals.email, 'user@example.com')
  t.end()
})

tap.test('accepts an israeli phone number in international form', function (t) {
  const calls = render(profileWith({ phone: '+972501234567' }))

  t.equal(calls[0].locals.phone, '+972501234567')
  t.end()
})

const rejected = [
  ['a malformed email', { email: 'not-an-email' }],
  ['an empty email', { email: '' }],
  ['a non-israeli phone number', { phone: '+14155552671' }],
  ['a phone number that is not a phone number', { phone: '12345' }],
  ['a non-ascii firstname', { firstname: 'Yoאv' }],
  ['a non-ascii lastname', { lastname: 'Cohenא' }],
  ['a non-ascii country', { country: 'ישראל' }],
  ['an empty firstname', { firstname: '' }],
]

rejected.forEach(function (entry) {
  tap.test('rejects ' + entry[0] + ' and renders the empty view', function (t) {
    const calls = render(profileWith(entry[1]))

    t.equal(calls.length, 1)
    t.equal(calls[0].view, 'account.hbs')
    t.equal(calls[0].locals, undefined)
    t.end()
  })
})
