import express = require('express');
import * as typeorm from "typeorm";
import { UserEntity } from '../entity/Users';

var router = express.Router()
export = router

router.get('/', async (req, res, next) => {

  const mongoConnection = typeorm.getConnection('mysql')
  const repo = mongoConnection.getRepository<UserEntity>("Users")

  // hard-coded getting account id of 1
  // as a rpelacement to getting this from the session and such
  // (just imagine that we implemented auth, etc)
  const results = await repo.find({ id: 1 })

  // Log Object's where property for debug reasons:
  console.log('The Object.where property is set to: ', ({} as any).where)
  console.log(results)

  return res.json(results)

})

router.post('/', async (req, res, next) => {
  try {
    const mongoConnection = typeorm.getConnection('mysql')
    const repo = mongoConnection.getRepository<UserEntity>("Users")

    const user = {} as UserEntity
    user.name = req.body.name
    user.address = req.body.address
    user.role = req.body.role

    const savedRecord = await repo.save(user)
    console.log("Post has been saved: ", savedRecord)
    return res.sendStatus(200)

  } catch (err) {
    console.error(err)
    console.log(({} as any).where)
    next();
  }
})
