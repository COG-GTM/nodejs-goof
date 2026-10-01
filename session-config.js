var MIN_SECRET_LENGTH = 32;

function sessionSecret(env) {
  var secret = env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET must be set to a random value of at least ' + MIN_SECRET_LENGTH + ' characters');
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error('SESSION_SECRET must be at least ' + MIN_SECRET_LENGTH + ' characters');
  }
  return secret;
}

function sessionOptions(env) {
  return {
    secret: sessionSecret(env),
    name: 'connect.sid',
    resave: false,
    saveUninitialized: false,
    proxy: env.SESSION_TRUST_PROXY === 'true' ? true : undefined,
    cookie: {
      path: '/',
      httpOnly: true,
      secure: env.SESSION_COOKIE_SECURE !== 'false',
      sameSite: 'lax'
    }
  };
}

module.exports = {
  MIN_SECRET_LENGTH: MIN_SECRET_LENGTH,
  sessionSecret: sessionSecret,
  sessionOptions: sessionOptions
};
