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
  mustChangePassword: { type: Boolean, default: false },
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

User = mongoose.model('User');

// The admin account is provisioned with the password given in ADMIN_PASSWORD.
// When that variable is not set, a random one-time password is generated and
// printed once to the server log, and has to be replaced on first login.
var adminUsername = process.env.ADMIN_USERNAME || 'admin@snyk.io';

User.findOne({ username: adminUsername }).exec(function (err, admin) {
  if (err) {
    console.log('error looking up the admin user');
    return;
  }

  if (admin) {
    return;
  }

  var providedPassword = process.env.ADMIN_PASSWORD;
  var password = providedPassword || utils.random_password();

  new User({
    username: adminUsername,
    passwordHash: utils.hash_password(password),
    mustChangePassword: !providedPassword,
  }).save(function (err, user, count) {
    if (err) {
      console.log('error saving admin user');
      return;
    }

    if (!providedPassword) {
      console.log('Generated a one-time password for ' + adminUsername + ': ' + password);
      console.log('It must be changed on first login. Set ADMIN_PASSWORD to provision your own.');
    }
  });
});