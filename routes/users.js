
var express = require('express')
var dataSource = require('../typeorm-db')

var router = express.Router()
module.exports = router

const USER_FIELDS = ['name', 'address', 'role']

// Builds a flat, own-properties-only record from the request body; every
// column must be a plain string so nested objects never reach the ORM.
function pickUserFields(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return null
  }
  const user = {}
  for (const field of USER_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, field)) {
      return null
    }
    const value = body[field]
    if (typeof value !== 'string') {
      return null
    }
    user[field] = value
  }
  return user
}
router.pickUserFields = pickUserFields

router.get('/', async (req, res, next) => {
  try {
    const repo = dataSource.getRepository("Users")

    // hard-coded getting account id of 1
    // as a replacement to getting this from the session and such
    // (just imagine that we implemented auth, etc)
    const results = await repo.find({ where: { id: 1 } })

    return res.json(results)
  } catch (err) {
    return next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const user = pickUserFields(req.body)
    if (user === null) {
      return res.status(400).json({ error: 'name, address and role must be strings' })
    }

    const repo = dataSource.getRepository("Users")
    const savedRecord = await repo.save(user)
    console.log("Post has been saved: ", savedRecord)
    return res.sendStatus(200)

  } catch (err) {
    return next(err)
  }
})
