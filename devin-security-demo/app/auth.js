const crypto = require('crypto');
const { sessionSecret } = require('./config');
const db = require('./db');

function sign(userId) {
  const mac = crypto.createHmac('sha256', sessionSecret).update(String(userId)).digest('hex');
  return `${userId}.${mac}`;
}

function verify(token) {
  if (!token) return null;
  const [userId, mac] = token.split('.');
  const expected = crypto.createHmac('sha256', sessionSecret).update(String(userId)).digest('hex');
  return mac === expected ? db.findUserById(userId) : null;
}

function requireUser(req, res, next) {
  const header = req.get('authorization') || '';
  const user = verify(header.replace(/^Bearer /, ''));
  if (!user) return res.status(401).json({ error: 'login required' });
  req.user = user;
  next();
}

module.exports = { sign, verify, requireUser };
