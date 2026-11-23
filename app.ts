/**
 * Module dependencies.
 */

// mongoose setup
import './mongoose-db';
import './typeorm-db'

import st from 'st';
import crypto from 'crypto';
import express from 'express';
import http from 'http';
import path from 'path';
import ejsEngine from 'ejs-locals';
import bodyParser from 'body-parser';
import session from 'express-session'
import methodOverride from 'method-override';
import logger from 'morgan';
import errorHandler from 'errorhandler';
import optional from 'optional';
import marked from 'marked';
import fileUpload from 'express-fileupload';
import dust from 'dustjs-linkedin';
import dustHelpers from 'dustjs-helpers';
import cons from 'consolidate';
import hbs from 'hbs'

var app = express();
import * as routes from './routes';
import routesUsers from './routes/users'

// all environments
app.set('port', process.env.PORT || 3001);
app.engine('ejs', ejsEngine);
app.engine('dust', cons.dust);
app.engine('hbs', hbs.__express);
cons.dust.helpers = dustHelpers;
// Compiled output runs from dist/, so templates live one level up.
app.set('views', path.join(__dirname, '..', 'views'));
app.set('view engine', 'ejs');
app.use(logger('dev'));
app.use(methodOverride());
app.use(session({
  secret: 'keyboard cat',
  name: 'connect.sid',
  cookie: { path: '/' }
}))
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

var token = 'SECRET_TOKEN_f8ed84e8f41e4146403dd4a6bbcea5e418d23a9';
console.log('token: ' + token);

http.createServer(app).listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});
