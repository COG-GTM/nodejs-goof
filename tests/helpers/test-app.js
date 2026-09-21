// Builds an Express app wired to the real route handlers, without touching
// MongoDB: the Mongoose models are registered locally and User.find is served
// from an in-memory list of seeded users.

var path = require('path');
var express = require('express');
var session = require('express-session');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var ejsEngine = require('ejs-locals');
var hbs = require('hbs');
var mongoose = require('mongoose');

if (!mongoose.models.Todo) {
  mongoose.model('Todo', new mongoose.Schema({
    content: Buffer,
    updated_at: Date,
  }));
}

if (!mongoose.models.User) {
  mongoose.model('User', new mongoose.Schema({
    username: String,
    password: String,
  }));
}

var User = mongoose.model('User');
var seededUsers = [];

User.find = function (query, callback) {
  var matches = seededUsers.filter(function (user) {
    return Object.keys(query).every(function (key) {
      return user[key] === query[key];
    });
  });
  process.nextTick(function () {
    callback(null, matches);
  });
};

var routes = require('../../routes');

function seedUsers(users) {
  seededUsers = users;
}

function createApp() {
  var app = express();

  app.engine('ejs', ejsEngine);
  app.engine('hbs', hbs.__express);
  app.set('views', path.join(__dirname, '..', '..', 'views'));
  app.set('view engine', 'ejs');

  app.use(methodOverride());
  app.use(session({
    secret: 'test secret',
    name: 'connect.sid',
    resave: false,
    saveUninitialized: true,
    cookie: { path: '/' },
  }));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));

  app.get('/', function (req, res) {
    res.status(200).send('home');
  });
  app.get('/login', routes.login);
  app.post('/login', routes.loginHandler);
  app.get('/admin', routes.isLoggedIn, routes.admin);
  app.get('/account_details', routes.isLoggedIn, routes.get_account_details);
  app.post('/account_details', routes.isLoggedIn, routes.save_account_details);
  app.get('/logout', routes.logout);

  return app;
}

module.exports = { createApp: createApp, seedUsers: seedUsers };
