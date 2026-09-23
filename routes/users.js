
var express = require('express')
var typeorm = require("typeorm");
var telemetry = require('../telemetry');

var router = express.Router()
module.exports = router

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

function actorOf(req) {
  return req.session && req.session.loggedIn === 1 ? 'authenticated-session' : 'anonymous'
}

router.post('/', async (req, res, next) => {
  try {
    const mongoConnection = typeorm.getConnection('mysql')
    const repo = mongoConnection.getRepository("Users")

    const user = {}
    user.name = req.body.name
    user.address = req.body.address
    user.role = req.body.role

    const savedRecord = await repo.save(user)

    telemetry.auditEvent('user.created', {
      actor: actorOf(req),
      created_user_id: savedRecord && savedRecord.id,
      role: user.role
    })
    telemetry.incrementCounter('user.create.succeeded')

    return res.sendStatus(200)

  } catch (err) {
    telemetry.trackError('user.create.failed', err, {
      actor: actorOf(req),
      role: req.body && req.body.role
    })
    telemetry.incrementCounter('user.create.failed')
    next(err);
  }
})