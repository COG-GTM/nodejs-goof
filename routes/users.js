
var express = require('express')
var typeorm = require("typeorm");

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

router.post('/', async (req, res, next) => {
  try {
    const mongoConnection = typeorm.getConnection('mysql')
    const repo = mongoConnection.getRepository("Users")

    const user = {}
    user.name = req.body.name
    user.address = req.body.address
    user.role = req.body.role

    const savedRecord = await repo.save(user)
    console.log(JSON.stringify({
      event: 'user_created',
      level: 'info',
      route: 'POST /users',
      userId: savedRecord && savedRecord.id
    }))
    return res.sendStatus(200)

  } catch (err) {
    console.error(JSON.stringify({
      event: 'user_create_failed',
      level: 'error',
      route: 'POST /users',
      errorName: err && err.name,
      errorCode: err && err.code,
      message: err && err.message
    }))
    next(err)
  }
})