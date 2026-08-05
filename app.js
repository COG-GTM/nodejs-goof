/**
 * Module dependencies.
 */

// mongoose setup
require('./mongoose-db');
require('./typeorm-db')

var crypto = require('crypto');
var fs = require('fs');
var express = require('express');
var https = require('https');
var path = require('path');
var expressLayouts = require('express-ejs-layouts');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session')
var methodOverride = require('method-override');
var logger = require('morgan');
var errorHandler = require('errorhandler');
var helmet = require('helmet');
var { rateLimit } = require('express-rate-limit');
var { doubleCsrf } = require('csrf-csrf');
var selfsigned = require('selfsigned');
var { marked } = require('marked');
var multer = require('multer');
var cons = require('consolidate');

var app = express();
var routes = require('./routes');
var routesUsers = require('./routes/users.js')

// Secrets are read from the environment; ephemeral values are generated for
// local development so that nothing sensitive is committed to the repository.
var sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
var csrfSecret = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');

// all environments
app.set('port', process.env.PORT || 3001);
app.disable('x-powered-by');
app.engine('hbs', cons.handlebars);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('layout', 'layout');
app.use(expressLayouts);
app.use(helmet());
app.use(logger('dev'));
app.use(methodOverride());
app.use(cookieParser());
// Static assets are served before the session and CSRF middleware so that they
// do not touch the session or rotate cookies.
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: sessionSecret,
  name: 'connect.sid',
  resave: false,
  saveUninitialized: false,
  cookie: { path: '/', httpOnly: true, secure: true, sameSite: 'strict' }
}))
app.use(bodyParser.json({ limit: '100kb' }));
app.use(bodyParser.urlencoded({ extended: false, limit: '100kb' }));
// Uploads are kept in memory and capped in size. The parser has to run before
// the CSRF check so that the token of a multipart form can be validated, but it
// is restricted to the one route that accepts a file.
var uploadImportFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 }
}).single('importFile');
app.use(function (req, res, next) {
  if (req.method === 'POST' && req.path === '/import') {
    return uploadImportFile(req, res, next);
  }
  next();
});

// Throttle every request so that expensive operations (rendering, archive
// extraction, image identification) cannot be used to exhaust the server.
var limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});
app.use(limiter);

var { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: function () { return csrfSecret; },
  getSessionIdentifier: function (req) { return req.sessionID || ''; },
  cookieName: '__Host-goof.x-csrf-token',
  cookieOptions: { path: '/', httpOnly: true, secure: true, sameSite: 'strict' },
  getCsrfTokenFromRequest: function (req) {
    return req.headers['x-csrf-token'] || (req.body && req.body._csrf);
  }
});
app.use(doubleCsrfProtection);
app.use(function (req, res, next) {
  // The CSRF token is bound to the session id, so the session has to be
  // persisted before a token is handed out.
  req.session.initialized = true;
  res.locals.csrfToken = generateCsrfToken(req, res);
  next();
});

// Routes
app.use(routes.current_user);
app.get('/', limiter, routes.index);
app.get('/login', limiter, routes.login);
app.post('/login', limiter, routes.loginHandler);
app.get('/admin', limiter, routes.isLoggedIn, routes.admin);
app.get('/account_details', limiter, routes.isLoggedIn, routes.get_account_details);
app.post('/account_details', limiter, routes.isLoggedIn, routes.save_account_details);
app.get('/logout', limiter, routes.logout);
app.post('/create', limiter, routes.create);
app.post('/destroy/:id', limiter, routes.destroy);
app.get('/edit/:id', limiter, routes.edit);
app.post('/update/:id', limiter, routes.update);
app.post('/import', limiter, routes.import);
app.get('/about_new', limiter, routes.about_new);
app.get('/chat', limiter, routes.chat.get);
app.put('/chat', limiter, routes.chat.add);
app.delete('/chat', limiter, routes.chat.delete);
app.use('/users', routesUsers)

// Add the option to output (sanitized!) markdown
marked.setOptions({ sanitize: true, silent: true });
app.locals.marked = marked;

// development only
if (app.get('env') == 'development') {
  app.use(errorHandler());
}

function tlsOptions() {
  var keyPath = process.env.TLS_KEY_PATH;
  var certPath = process.env.TLS_CERT_PATH;

  if (keyPath && certPath) {
    return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
  }

  console.warn('TLS_KEY_PATH/TLS_CERT_PATH are not set, generating a self-signed certificate');
  var generated = selfsigned.generate([{ name: 'commonName', value: 'localhost' }], { days: 1, keySize: 2048 });
  return { key: generated.private, cert: generated.cert };
}

https.createServer(tlsOptions(), app).listen(app.get('port'), function () {
  console.log('Express server listening on https://localhost:' + app.get('port'));
});
