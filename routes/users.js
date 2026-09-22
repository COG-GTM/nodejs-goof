var express = require('express')
var typeorm = require("typeorm");

var router = express.Router()
module.exports = router

// Role is a security-sensitive column: it is always assigned server-side and
// never read from the request body.
var DEFAULT_ROLE = 'user'
var MAX_FIELD_LENGTH = 255

function requireAuthentication (req, res, next) {
  if (req.session && req.session.loggedIn === 1) {
    return next()
  }

  return res.status(401).json({ error: 'authentication required' })
}

function readStringField (value) {
  if (typeof value !== 'string') {
    return null
  }

  var trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_FIELD_LENGTH) {
    return null
  }

  return trimmed
}

function roleForSession (session) {
  return session && session.role === 'admin' ? 'admin' : DEFAULT_ROLE
}

router.get('/', async (req, res, next) => {

  const mongoConnection = typeorm.getConnection('mysql')
  const repo = mongoConnection.getRepository("Users")

  // hard-coded getting account id of 1
  // as a rpelacement to getting this from the session and such
  // (just imagine that we implemented auth, etc)
  const results = await repo.find({ id: 1 })

  // Log Object's where property for debug reasons:
  console.log('The Object.where property is set to: ', {}.where)
  console.log(results)

  return res.json(results)

})

router.post('/', requireAuthentication, async (req, res, next) => {
  try {
    const body = req.body || {}
    const name = readStringField(body.name)
    const address = readStringField(body.address)

    if (name === null || address === null) {
      return res.status(400).json({ error: 'name and address are required strings' })
    }

    const mongoConnection = typeorm.getConnection('mysql')
    const repo = mongoConnection.getRepository("Users")

    const user = {
      name: name,
      address: address,
      role: roleForSession(req.session)
    }

    const savedRecord = await repo.save(user)
    console.log("Post has been saved: ", savedRecord)
    return res.sendStatus(200)

  } catch (err) {
    console.error(err)
    console.log({}.where)
    next();
  }
})
