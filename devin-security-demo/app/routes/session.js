const express = require('express');
const db = require('../db');
const { sign } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const user = db.findUser(req.body.username);
  if (!user || user.password !== req.body.password) {
    return res.status(401).json({ error: 'bad credentials' });
  }
  res.json({ token: sign(user.id), user: { id: user.id, username: user.username } });
});

module.exports = router;
