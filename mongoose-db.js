var mongoose = require('mongoose');
var cfenv = require("cfenv");
var utils = require('./utils');
var Schema = mongoose.Schema;

var Todo = new Schema({
  content: Buffer,
  updated_at: Date,
});

mongoose.model('Todo', Todo);

var User = new Schema({
  username: String,
  passwordHash: String,
});

mongoose.model('User', User);

// CloudFoundry env vars
var mongoCFUri = cfenv.getAppEnv().getServiceURL('goof-mongo');
console.log(JSON.stringify(cfenv.getAppEnv()));

// Default Mongo URI is local
const DOCKER = process.env.DOCKER
if (DOCKER === '1') {
  var mongoUri = 'mongodb://goof-mongo/express-todo';
} else {
  var mongoUri = 'mongodb://localhost/express-todo';
}


// CloudFoundry Mongo URI
if (mongoCFUri) {
  mongoUri = mongoCFUri;
} else if (process.env.MONGOLAB_URI) {
  // Generic (plus Heroku) env var support
  mongoUri = process.env.MONGOLAB_URI;
} else if (process.env.MONGODB_URI) {
  // Generic (plus Heroku) env var support
  mongoUri = process.env.MONGODB_URI;
}

console.log("Using Mongo URI " + mongoUri);

mongoose.connect(mongoUri);

var adminUsername = process.env.ADMIN_USERNAME || 'admin@example.com';

User = mongoose.model('User');
User.find({ username: adminUsername }).exec(function (err, users) {
  if (err) {
    console.log('error looking up the admin user');
    return;
  }

  if (users.length > 0) {
    return;
  }

  // No credential is committed to source: use ADMIN_PASSWORD when provided,
  // otherwise provision a random one-time password and print it once.
  var adminPassword = process.env.ADMIN_PASSWORD;
  var generated = false;
  if (!adminPassword) {
    adminPassword = utils.random_password();
    generated = true;
  }

  new User({
    username: adminUsername,
    passwordHash: utils.hash_password(adminPassword),
  }).save(function (err, user, count) {
    if (err) {
      console.log('error saving admin user');
      return;
    }

    if (generated) {
      console.log('Provisioned admin user ' + adminUsername +
        ' with the one-time password: ' + adminPassword);
      console.log('Only the hash is stored - set ADMIN_USERNAME/ADMIN_PASSWORD to choose your own.');
    }
  });
});