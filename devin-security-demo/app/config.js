const MIN_SECRET_LENGTH = 32;

function loadSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET must be set to a random value of at least ${MIN_SECRET_LENGTH} characters`);
  }
  return secret;
}

function loadSessionTtlSeconds() {
  const ttl = Number(process.env.SESSION_TTL_SECONDS || 3600);
  if (!Number.isInteger(ttl) || ttl <= 0) {
    throw new Error('SESSION_TTL_SECONDS must be a positive integer');
  }
  return ttl;
}

module.exports = {
  port: process.env.PORT || 3000,
  sessionSecret: loadSessionSecret(),
  sessionTtlSeconds: loadSessionTtlSeconds(),
  uploadsDir: require('path').join(__dirname, 'uploads')
};
