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
var expressLayouts = require('express-ejs-layouts');
var bodyParser = require('body-parser');
var session = require('express-session')
var methodOverride = require('method-override');
var logger = require('morgan');
var errorHandler = require('errorhandler');
var optional = require('optional');
var marked = require('marked');
var fileUpload = require('express-fileupload');
var dust = require('dustjs-linkedin');
var cons = require('consolidate');
const hbs = require('hbs')

var app = express();
app.disable('x-powered-by');
var routes = require('./routes');
var routesUsers = require('./routes/users.js')

// all environments
app.set('port', process.env.PORT || 3001);
app.engine('dust', cons.dust);
app.engine('hbs', hbs.__express);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('layout', 'layout');
app.use(expressLayouts);
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
    secure: process.env.NODE_ENV === 'production'
  }
}))
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(fileUpload());

app.use(routes.limiter);

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

// Add the option to output (escaped!) markdown
marked.setOptions({ headerIds: false, mangle: false });
app.locals.marked = function (input) {
  return marked.parse(escapeHtml(String(input)));
};

// development only
if (app.get('env') == 'development') {
  app.use(errorHandler());
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

http.createServer(app).listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});
