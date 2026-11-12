var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');
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

var BCRYPT_ROUNDS = 12;
var BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
var ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin@snyk.io';
var ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function setAdminPassword(user) {
  bcrypt.hash(ADMIN_PASSWORD, BCRYPT_ROUNDS, function (err, hash) {
    if (err) {
      return console.log('error hashing admin password');
    }
    user.password = hash;
    user.save(function (err) {
      if (err) {
        console.log('error saving admin user');
      }
    });
  });
}

User.findOne({ username: ADMIN_USERNAME }).exec(function (err, admin) {
  if (err) {
    return console.log('error looking up admin user');
  }
  if (admin && BCRYPT_HASH.test(admin.password || '')) {
    return;
  }
  if (!ADMIN_PASSWORD) {
    return console.log(admin
      ? 'Admin user ' + ADMIN_USERNAME + ' has no hashed password and cannot log in. Set ADMIN_PASSWORD to reset it.'
      : 'No admin user. Set ADMIN_PASSWORD (and optionally ADMIN_USERNAME) to create one on startup.');
  }
  setAdminPassword(admin || new User({ username: ADMIN_USERNAME }));
});
