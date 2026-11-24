const express = require('express');
const path = require('path');
const { requireUser } = require('../auth');
const { uploadsDir } = require('../config');

const router = express.Router();
router.use(requireUser);

router.get('/', (req, res) => {
  res.sendFile(path.join(uploadsDir, req.query.name));
});

module.exports = router;
