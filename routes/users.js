var express = require('express')
var dataSource = require('../typeorm-db')

var router = express.Router()
module.exports = router

function asString(value) {
  return typeof value === 'string' ? value : undefined
}

router.get('/', async (req, res, next) => {
  try {
    const repo = dataSource.getRepository("Users")

    // hard-coded getting account id of 1
    // as a rpelacement to getting this from the session and such
    // (just imagine that we implemented auth, etc)
    const results = await repo.findBy({ id: 1 })

    console.log(results)

    return res.json(results)
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const repo = dataSource.getRepository("Users")

    const user = {
      name: asString(req.body.name),
      address: asString(req.body.address),
      role: asString(req.body.role)
    }

    const savedRecord = await repo.save(user)
    console.log("Post has been saved: ", savedRecord)
    return res.sendStatus(200)

  } catch (err) {
    console.error(err)
    next(err);
  }
})
