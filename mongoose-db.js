var mongoose = require('mongoose');
var cfenv = require("cfenv");
var passwords = require('./passwords');
var Schema = mongoose.Schema;

var Todo = new Schema({
  content: Buffer,
  updated_at: Date,
});

mongoose.model('Todo', Todo);

var User = new Schema({
  username: String,
  // Only ever holds a salted scrypt hash (see passwords.js), never plaintext
  password: String,
});

User.pre('save', function (next) {
  var user = this;
  if (!user.isModified('password') || passwords.isHashed(user.password)) {
    return next();
  }
  passwords.hash(user.password, function (err, hashed) {
    if (err) return next(err);
    user.password = hashed;
    next();
  });
});

User.methods.verifyPassword = function (candidate, cb) {
  passwords.verify(candidate, this.password, cb);
};

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

// Re-save any legacy plaintext passwords so the pre-save hook hashes them
User.find({ password: { $not: /^scrypt\$/ } }).exec(function (err, users) {
  if (err) {
    return console.log('error looking up users with unhashed passwords');
  }
  users.forEach(function (user) {
    user.markModified('password');
    user.save(function (err) {
      if (err) {
        console.log('error hashing password for user ' + user.username);
      }
    });
  });
});

User.find({ username: 'admin@snyk.io' }).exec(function (err, users) {
  if (err) {
    return console.log('error looking up admin user');
  }
  if (users.length === 0) {
    console.log('no admin');
    var adminPassword = process.env.GOOF_ADMIN_PASSWORD || 'SuperSecretPassword';
    new User({ username: 'admin@snyk.io', password: adminPassword }).save(function (err, user, count) {
      if (err) {
        console.log('error saving admin user');
      }
    });
  }
});