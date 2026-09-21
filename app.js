/**
 * Module dependencies.
 */

// mongoose setup
require('./mongoose-db');
require('./typeorm-db')

var st = require('st');
var crypto = require('crypto');
var express = require('express');
var https = require('https');
var fs = require('fs');
var path = require('path');
var ejsEngine = require('ejs-locals');
var bodyParser = require('body-parser');
var session = require('express-session')
var methodOverride = require('method-override');
var logger = require('morgan');
var errorHandler = require('errorhandler');
var optional = require('optional');
var marked = require('marked');
var fileUpload = require('express-fileupload');
var dust = require('dustjs-linkedin');
var dustHelpers = require('dustjs-helpers');
var cons = require('consolidate');
const hbs = require('hbs')

var app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
var routes = require('./routes');
var routesUsers = require('./routes/users.js')

var sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET environment variable must be set in production');
  }
  sessionSecret = crypto.randomBytes(32).toString('hex');
  console.warn('SESSION_SECRET not set; using a random secret for this process (sessions will not survive restarts)');
}

var token = process.env.APP_TOKEN;
if (!token) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('APP_TOKEN environment variable must be set in production');
  }
  token = crypto.randomBytes(32).toString('hex');
}
app.set('appToken', token);

// Same-origin enforcement for state-changing requests (CSRF defence):
// browsers always send Origin (or Referer) on cross-site form posts, so a
// mismatching value is rejected. Requests with neither header (curl, same-origin
// with strict referrer policy) are allowed through unchanged.
function sameOriginGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].indexOf(req.method) !== -1) {
    return next();
  }
  var source = req.get('origin') || req.get('referer');
  if (!source) {
    return next();
  }
  var sourceHost;
  try {
    sourceHost = new URL(source).host;
  } catch (e) {
    return res.status(403).send('Invalid request origin');
  }
  if (sourceHost !== req.get('host')) {
    return res.status(403).send('Cross-origin request rejected');
  }
  next();
}

// all environments
app.set('port', process.env.PORT || 3001);
app.engine('ejs', ejsEngine);
app.engine('dust', cons.dust);
app.engine('hbs', hbs.__express);
cons.dust.helpers = dustHelpers;
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(logger('dev'));
app.use(methodOverride());
app.use(session({
  secret: sessionSecret,
  name: 'connect.sid',
  resave: false,
  saveUninitialized: true,
  cookie: {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}))
app.use(sameOriginGuard);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(fileUpload());

// Routes
app.use(routes.current_user);
app.get('/', routes.index);
app.get('/login', routes.login);
app.post('/login', routes.loginHandler);
app.get('/admin', routes.isLoggedIn, routes.admin);
app.get('/account_details', routes.isLoggedIn, routes.get_account_details);
app.post('/account_details', routes.isLoggedIn, routes.save_account_details);
app.get('/logout', routes.logout);
app.post('/create', routes.create);
app.get('/destroy/:id', routes.destroy);
app.get('/edit/:id', routes.edit);
app.post('/update/:id', routes.update);
app.post('/import', routes.import);
app.get('/about_new', routes.about_new);
app.get('/chat', routes.chat.get);
app.put('/chat', routes.chat.add);
app.delete('/chat', routes.chat.delete);
app.use('/users', routesUsers)

// Static
app.use(st({ path: './public', url: '/public' }));

// Add the option to output (sanitized!) markdown
marked.setOptions({ sanitize: true });
app.locals.marked = marked;

// development only
if (app.get('env') == 'development') {
  app.use(errorHandler());
}

// Serve TLS directly when a key/cert pair is provided; otherwise plain HTTP is
// used for local development and TLS is expected to be terminated by a proxy.
function onListening() {
  console.log('Express server listening on port ' + app.get('port'));
}

if (process.env.TLS_KEY && process.env.TLS_CERT) {
  https.createServer({
    key: fs.readFileSync(process.env.TLS_KEY),
    cert: fs.readFileSync(process.env.TLS_CERT)
  }, app).listen(app.get('port'), onListening);
} else {
  app.listen(app.get('port'), onListening);
}
