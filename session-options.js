var crypto = require('crypto');

module.exports = function sessionOptions(env) {
  env = env || process.env;
  var isProduction = env.NODE_ENV === 'production';
  var secret = env.SESSION_SECRET;

  if (!secret) {
    if (isProduction) {
      throw new Error('SESSION_SECRET environment variable must be set in production');
    }
    secret = crypto.randomBytes(32).toString('hex');
  }

  return {
    secret: secret,
    name: 'connect.sid',
    proxy: isProduction,
    cookie: {
      path: '/',
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax'
    }
  };
};
