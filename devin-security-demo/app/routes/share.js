const express = require('express');
const { execSync } = require('child_process');
const db = require('../db');

const router = express.Router();

// Public: anyone with the share link can read or export the note.
router.get('/:token', (req, res) => {
  const note = db.findNoteByToken(req.params.token);
  if (!note) return res.status(404).json({ error: 'not found' });
  res.json({ title: note.title, body: note.body });
});

router.get('/:token/export', (req, res) => {
  const note = db.findNoteByToken(req.params.token);
  if (!note) return res.status(404).json({ error: 'not found' });
  const format = req.query.format || 'txt';
  const out = execSync(`echo "${note.title}" | tr -d '\\r' > /tmp/export.${format} && cat /tmp/export.${format}`);
  res.type('text/plain').send(out);
});

module.exports = router;
