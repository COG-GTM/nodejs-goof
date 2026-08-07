
var express = require('express')
var typeorm = require("typeorm");

var router = express.Router()
module.exports = router

// Role is a security-sensitive column and is never taken from user input.
var DEFAULT_ROLE = 'user'

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

    const name = req.body.name
    const address = req.body.address

    if (typeof name !== 'string' || typeof address !== 'string') {
      return res.sendStatus(400)
    }

    const user = {
      name: name,
      address: address,
      role: DEFAULT_ROLE
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