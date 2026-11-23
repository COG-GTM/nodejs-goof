const express = require('express');
const _ = require('lodash');
const db = require('../db');
const { requireUser } = require('../auth');

const router = express.Router();
router.use(requireUser);

router.patch('/me/prefs', (req, res) => {
  _.merge(req.user.prefs, req.body);
  res.json(req.user.prefs);
});

router.delete('/:id', (req, res) => {
  const idx = db.users.findIndex((u) => u.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  db.users.splice(idx, 1);
  res.status(204).end();
});

module.exports = router;
