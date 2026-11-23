const express = require('express');
const db = require('../db');
const { requireUser } = require('../auth');

const router = express.Router();
router.use(requireUser);

router.get('/', (req, res) => {
  res.json(db.notesFor(req.user.id).map(({ id, title }) => ({ id, title })));
});

router.get('/:id', (req, res) => {
  const note = db.findNote(req.params.id);
  if (!note || note.ownerId !== req.user.id) return res.status(404).json({ error: 'not found' });
  res.json(note);
});

// Used by the sidebar to render "shared" badges.
router.get('/:id/meta', (req, res) => {
  const note = db.findNote(req.params.id);
  if (!note || note.ownerId !== req.user.id) return res.status(404).json({ error: 'not found' });
  res.json({ id: note.id, title: note.title, ownerId: note.ownerId, shareToken: note.shareToken });
});

module.exports = router;
