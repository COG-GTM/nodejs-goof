var express = require('express')
var typeorm = require("typeorm");

var router = express.Router()
module.exports = router

var DEFAULT_ROLE = 'user'
var FIELD_LIMITS = { name: 100, address: 200 }
var CONTROL_CHARS = /[\u0000-\u001f\u007f]/

function requireSession(req, res, next) {
  var session = req.session
  if (session && session.loggedIn === 1 && typeof session.username === 'string' && session.username) {
    return next()
  }
  return res.status(401).json({ error: 'authentication required' })
}

function validateUserInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'request body must be a JSON object' }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'role')) {
    return { error: 'role cannot be supplied by the client' }
  }
  var unexpected = Object.keys(body).filter(function (key) {
    return !Object.prototype.hasOwnProperty.call(FIELD_LIMITS, key)
  })
  if (unexpected.length > 0) {
    return { error: 'unexpected fields: ' + unexpected.join(', ') }
  }
  var user = {}
  var fields = Object.keys(FIELD_LIMITS)
  for (var i = 0; i < fields.length; i++) {
    var field = fields[i]
    var value = body[field]
    if (typeof value !== 'string') {
      return { error: field + ' must be a string' }
    }
    value = value.trim()
    if (value.length === 0 || value.length > FIELD_LIMITS[field]) {
      return { error: field + ' must be 1-' + FIELD_LIMITS[field] + ' characters' }
    }
    if (CONTROL_CHARS.test(value)) {
      return { error: field + ' must not contain control characters' }
    }
    user[field] = value
  }
  return { user: user }
}

function logFailure(event, err) {
  console.error(JSON.stringify({ event: event, error: err && err.name, code: err && err.code }))
}

router.use(requireSession)

router.get('/', async (req, res, next) => {
  try {
    const connection = typeorm.getConnection('mysql')

    // hard-coded getting account id of 1
    // as a replacement to getting this from the session and such
    const results = await connection.getRepository("Users").find({
      select: ['id', 'name', 'address', 'role'],
      where: { id: 1 }
    })

    await connection.getRepository("AuditLog").save(results.map(function (user) {
      return { action: 'user.read', actor: req.session.username, targetUserId: user.id, role: null }
    }))

    return res.json(results)
  } catch (err) {
    logFailure('user.read.failed', err)
    return next(err)
  }
})

router.post('/', async (req, res, next) => {
  const validation = validateUserInput(req.body)
  if (validation.error) {
    return res.status(400).json({ error: validation.error })
  }

  try {
    const connection = typeorm.getConnection('mysql')
    const actor = req.session.username

    const savedRecord = await connection.transaction(async (manager) => {
      const user = Object.assign({}, validation.user, { role: DEFAULT_ROLE })
      const saved = await manager.getRepository("Users").save(user)
      await manager.getRepository("AuditLog").save([
        { action: 'user.created', actor: actor, targetUserId: saved.id, role: null },
        { action: 'user.role.assigned', actor: actor, targetUserId: saved.id, role: saved.role }
      ])
      return saved
    })

    console.log(JSON.stringify({ event: 'user.created', userId: savedRecord.id }))
    return res.status(201).json({ id: savedRecord.id, role: savedRecord.role })
  } catch (err) {
    logFailure('user.create.failed', err)
    return next(err)
  }
})
