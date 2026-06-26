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
var routes = require('./routes');
var routesUsers = require('./routes/users.js')

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
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  name: 'connect.sid',
  cookie: { path: '/', secure: true, httpOnly: true, sameSite: 'strict' }
}))
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(fileUpload());

// CSRF mitigation: SameSite=Strict on the session cookie (above) prevents the
// authenticated cookie from being sent on cross-site requests. We also issue a
// per-session synchronizer token and expose it to views so forms can include it.
app.use(function (req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

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

var token = process.env.SECRET_TOKEN || crypto.randomBytes(32).toString('hex');
console.log('token loaded: ' + (token ? '[set]' : '[unset]'));

function buildTlsOptions() {
  var fs = require('fs');
  if (process.env.TLS_KEY && process.env.TLS_CERT) {
    return {
      key: fs.readFileSync(process.env.TLS_KEY),
      cert: fs.readFileSync(process.env.TLS_CERT)
    };
  }
  // No certificate configured: generate an ephemeral self-signed certificate so
  // local/demo runs still serve over HTTPS. In production supply TLS_KEY and
  // TLS_CERT pointing at a CA-issued certificate.
  var os = require('os');
  var execFileSync = require('child_process').execFileSync;
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'goof-tls-'));
  var keyPath = path.join(dir, 'key.pem');
  var certPath = path.join(dir, 'cert.pem');
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', keyPath, '-out', certPath,
    '-days', '365', '-subj', '/CN=localhost'
  ], { stdio: 'ignore' });
  return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };
}

https.createServer(buildTlsOptions(), app).listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});
