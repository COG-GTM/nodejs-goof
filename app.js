/**
 * Module dependencies.
 */

// mongoose setup
require('./mongoose-db');
require('./typeorm-db')

var crypto = require('crypto');
var express = require('express');
var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');
var ejsEngine = require('ejs-mate');
var bodyParser = require('body-parser');
var session = require('express-session')
var methodOverride = require('method-override');
var logger = require('morgan');
var errorHandler = require('errorhandler');
var helmet = require('helmet');
var lusca = require('lusca');
var multer = require('multer');
var renderMarkdown = require('./lib/markdown');
var viewEngines = require('./lib/view-engines');

var app = express();
var routes = require('./routes');
var routesUsers = require('./routes/users.js')

var isProduction = process.env.NODE_ENV === 'production';

// all environments
app.set('port', process.env.PORT || 3001);
app.engine('ejs', ejsEngine);
app.engine('dust', viewEngines.dust);
app.engine('hbs', viewEngines.handlebars);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.disable('x-powered-by');
if (isProduction) {
  app.set('trust proxy', 1);
}
app.use(helmet());
var limiter = routes.limiter;
app.use(logger('dev'));
app.use(methodOverride());
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  name: 'connect.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction
  }
}))
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/import', multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024, files: 1 }
}).single('importFile'));
// /chat authenticates with credentials in the JSON body, not the session cookie.
app.use(lusca.csrf({ blocklist: ['/chat'] }));

// Routes
app.use(routes.current_user);
app.use(routes.router);
app.use('/users', limiter, routesUsers)

// Static
app.use('/public', limiter, express.static(path.join(__dirname, 'public')));

// Markdown output with raw HTML escaped
app.locals.marked = renderMarkdown;

// development only
if (app.get('env') == 'development') {
  app.use(errorHandler());
}

function createServer() {
  if (process.env.TLS_KEY_FILE && process.env.TLS_CERT_FILE) {
    return https.createServer({
      key: fs.readFileSync(process.env.TLS_KEY_FILE),
      cert: fs.readFileSync(process.env.TLS_CERT_FILE)
    }, app);
  }
  // TLS is expected to be terminated by a reverse proxy when no certificate is configured.
  return http.createServer(app);
}

createServer().listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});
