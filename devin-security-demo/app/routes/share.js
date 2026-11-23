const express = require('express');
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
  if (format !== 'txt') return res.status(400).json({ error: 'unsupported format' });
  res.type('text/plain').send(note.title.replace(/\r/g, ''));
});

module.exports = router;
