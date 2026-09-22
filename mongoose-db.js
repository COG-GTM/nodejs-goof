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

User = mongoose.model('User');

var adminUsername = process.env.ADMIN_USERNAME || 'admin@snyk.io';

User.find({ username: adminUsername }).exec(function (err, users) {
  if (err) {
    console.log('error looking up admin user');
    return;
  }

  if (users.length > 0) {
    return;
  }

  // No static credentials in source: the password comes from the environment,
  // otherwise a random one is generated and printed once at provisioning time.
  var adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    adminPassword = utils.random_password();
    console.log('Generated admin password for ' + adminUsername + ': ' + adminPassword);
    console.log('Store it now - it is not persisted in plaintext and will not be shown again.');
  }

  new User({
    username: adminUsername,
    passwordHash: utils.hash_password(adminPassword),
  }).save(function (err) {
    if (err) {
      console.log('error saving admin user');
    }
  });
});