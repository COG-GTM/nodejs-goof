/**
 * Module dependencies.
 */

// mongoose setup
require('./mongoose-db');
require('./typeorm-db')

var st = require('st');
var crypto = require('crypto');
var express = require('express');
var http = require('http');
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
const hbs = require('hbs');
const helmet = require('helmet');

var app = express();
var routes = require('./routes');
var routesUsers = require('./routes/users.js')

// Security: Use helmet to set secure HTTP headers (disables X-Powered-By, adds security headers)
app.use(helmet());

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

// Security: Use environment variable for session secret, secure cookie settings
var sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
app.use(session({
  secret: sessionSecret,
  name: 'connect.sid',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
}))
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 },
  abortOnLimit: true
}));

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

// Add the option to output markdown (marked v12+ uses .parse method instead of direct call)
app.locals.marked = marked.parse;

// development only
if (app.get('env') == 'development') {
  app.use(errorHandler());
}

// Security: Use environment variable for API token instead of hardcoding
var token = process.env.API_TOKEN || crypto.randomBytes(32).toString('hex');
if (process.env.NODE_ENV === 'development') {
  console.log('token: ' + token);
}

http.createServer(app).listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});
