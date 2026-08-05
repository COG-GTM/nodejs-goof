var mongoose = require('mongoose');
var cfenv = require("cfenv");
var crypto = require('crypto');
var Schema = mongoose.Schema;

var Todo = new Schema({
  content: Buffer,
  updated_at: Date,
});

mongoose.model('Todo', Todo);

var User = new Schema({
  username: String,
  password: String,
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

// Seeded admin credentials come from the environment. When ADMIN_PASSWORD is not
// set a random password is generated and printed once so local dev still works.
var adminUsername = process.env.ADMIN_USER || 'admin@snyk.io';
var adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(16).toString('hex');

User = mongoose.model('User');
User.find({ username: adminUsername }).exec(function (err, users) {
  console.log(users);
  if (users.length === 0) {
    console.log('no admin');
    new User({ username: adminUsername, password: adminPassword }).save(function (err, user, count) {
      if (err) {
        console.log('error saving admin user');
        return;
      }
      if (!process.env.ADMIN_PASSWORD) {
        console.log('Seeded admin user ' + adminUsername + ' with generated password: ' + adminPassword);
        console.log('Set ADMIN_USER / ADMIN_PASSWORD to choose the seeded credentials.');
      }
    });
  }
});