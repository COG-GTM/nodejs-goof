
var express = require('express')
var typeorm = require("typeorm");

var router = express.Router()
module.exports = router

var DEFAULT_ROLE = 'user'
var ASSIGNABLE_ROLES = ['user', 'admin']

function requireAuthentication(req, res, next) {
  if (req.session && req.session.loggedIn === 1) {
    return next()
  }
  return res.status(401).json({ error: 'authentication required' })
}

// Only admins may choose a role; everyone else always creates a plain user.
function roleForRequest(req) {
  var requested = req.body && req.body.role
  if (req.session.role === 'admin' && ASSIGNABLE_ROLES.indexOf(requested) !== -1) {
    return requested
  }
  return DEFAULT_ROLE
}

router.use(requireAuthentication)

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

router.post('/', async (req, res, next) => {
  try {
    const mongoConnection = typeorm.getConnection('mysql')
    const repo = mongoConnection.getRepository("Users")

    const user = {}
    user.name = req.body.name
    user.address = req.body.address
    user.role = roleForRequest(req)

    const savedRecord = await repo.save(user)
    console.log("Post has been saved: ", savedRecord)
    return res.sendStatus(200)

  } catch (err) {
    console.error(err)
    console.log({}.where)
    next();
  }
})