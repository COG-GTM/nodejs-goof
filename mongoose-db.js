var mongoose = require('mongoose');
var cfenv = require("cfenv");
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

console.log("Using Mongo URI " + String(mongoUri).replace(/\/\/[^@\/]*@/, "//<credentials>@"));

var security = require('./lib/security');

mongoose.connect(mongoUri).catch(function (err) {
  console.error('failed connecting to MongoDB', err);
});

// Seed the admin user only when ADMIN_PASSWORD is provided; the password is stored as a scrypt hash.
User = mongoose.model('User');
if (process.env.ADMIN_PASSWORD) {
  User.findOneAndUpdate(
    { username: 'admin@snyk.io' },
    { username: 'admin@snyk.io', password: security.hashPassword(process.env.ADMIN_PASSWORD) },
    { upsert: true }
  ).exec().catch(function (err) {
    console.log('error saving admin user', err);
  });
} else {
  console.log('ADMIN_PASSWORD is not set; skipping admin user seeding');
}
