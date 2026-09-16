
var express = require('express')
var dataSource = require('../typeorm-db')

var router = express.Router()
module.exports = router

router.get('/', async (req, res, next) => {
  try {
    const repo = dataSource.getRepository("Users")

    // hard-coded getting account id of 1
    // as a rpelacement to getting this from the session and such
    // (just imagine that we implemented auth, etc)
    const results = await repo.find({ where: { id: 1 } })

    return res.json(results)
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const repo = dataSource.getRepository("Users")

    const user = {}
    user.name = String(req.body.name)
    user.address = String(req.body.address)
    user.role = String(req.body.role)

    const savedRecord = await repo.save(user)
    console.log("Post has been saved: ", savedRecord)
    return res.sendStatus(200)

  } catch (err) {
    next(err);
  }
})
