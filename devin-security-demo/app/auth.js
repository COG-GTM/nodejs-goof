const crypto = require('crypto');
const { sessionSecret, sessionTtlSeconds } = require('./config');
const db = require('./db');

function mac(payload) {
  return crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
}

function sign(userId, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const payload = Buffer.from(JSON.stringify({ sub: userId, iat, exp: Math.ceil(now / 1000) + sessionTtlSeconds })).toString('base64url');
  return `${payload}.${mac(payload)}`;
}

function verify(token, now = Date.now()) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = Buffer.from(mac(payload));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const nowSeconds = Math.floor(now / 1000);
  if (!Number.isInteger(claims.iat) || !Number.isInteger(claims.exp)) return null;
  if (claims.exp <= nowSeconds || claims.iat > nowSeconds + 60) return null;
  return db.findUserById(claims.sub) || null;
}

function requireUser(req, res, next) {
  const header = req.get('authorization') || '';
  const user = verify(header.replace(/^Bearer /, ''));
  if (!user) return res.status(401).json({ error: 'login required' });
  req.user = user;
  next();
}

module.exports = { sign, verify, requireUser };
