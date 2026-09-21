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
var expressLayouts = require('express-ejs-layouts');
var session = require('express-session')
var methodOverride = require('method-override');
var logger = require('morgan');
var errorHandler = require('errorhandler');
var lusca = require('lusca');
var { marked } = require('marked');
var sanitizeHtml = require('sanitize-html');
var fileUpload = require('express-fileupload');
var dust = require('dustjs-linkedin');
const hbs = require('hbs')

var app = express();
var routes = require('./routes');
var routesUsers = require('./routes/users.js')

var isProduction = app.get('env') === 'production';
var sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

function dustEngine(filePath, options, callback) {
  fs.readFile(filePath, 'utf8', function (err, source) {
    if (err) return callback(err);
    dust.renderSource(source, options, callback);
  });
}

// all environments
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.set('port', process.env.PORT || 3001);
app.engine('ejs', require('ejs').__express);
app.engine('dust', dustEngine);
app.engine('hbs', hbs.__express);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('layout', 'layout');
app.use(expressLayouts);
app.use(logger('dev'));
app.use(methodOverride());
app.use(session({
  secret: sessionSecret,
  name: 'connect.sid',
  resave: false,
  saveUninitialized: false,
  cookie: { path: '/', httpOnly: true, sameSite: 'lax', secure: isProduction }
}))
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(fileUpload({ limits: { fileSize: 5 * 1024 * 1024 } }));

// JSON APIs (authenticated via request body, not cookies)
app.get('/chat', routes.chat.get);
app.put('/chat', routes.chat.add);
app.delete('/chat', routes.chat.delete);
app.use('/users', routesUsers)

// Routes
app.use(lusca.csrf());
app.use(routes.current_user);
app.get('/', routes.index);
app.get('/login', routes.login);
app.post('/login', routes.loginLimiter, routes.loginHandler);
app.get('/admin', routes.isLoggedIn, routes.admin);
app.get('/account_details', routes.isLoggedIn, routes.get_account_details);
app.post('/account_details', routes.isLoggedIn, routes.save_account_details);
app.get('/logout', routes.logout);
app.post('/create', routes.create);
app.get('/destroy/:id', routes.destroy);
app.get('/edit/:id', routes.edit);
app.post('/update/:id', routes.update);
app.post('/import', routes.importLimiter, routes.import);
app.get('/about_new', routes.about_new);

// Static
app.use('/public', express.static(path.join(__dirname, 'public')));

// Add the option to output (sanitized!) markdown
app.locals.marked = function (src) {
  return sanitizeHtml(marked.parse(String(src), { async: false }));
};

// development only
if (app.get('env') == 'development') {
  app.use(errorHandler());
}

var server;
if (process.env.TLS_KEY && process.env.TLS_CERT) {
  server = https.createServer({
    key: fs.readFileSync(process.env.TLS_KEY),
    cert: fs.readFileSync(process.env.TLS_CERT),
  }, app);
} else {
  server = http.createServer(app);
}

server.listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});
