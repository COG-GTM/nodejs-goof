var mongoose = require('mongoose');
var cfenv = require("cfenv");
var passwordHash = require('./password-hash');
var validator = require('validator');
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

User.pre('save', function (next) {
  if (this.isModified('password')) {
    var user = this;
    passwordHash.hashPassword(this.password, function (err, hashedPassword) {
      if (err) return next(err);
      user.password = hashedPassword;
      next();
    });
  } else {
    next();
  }
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
var adminPassword = process.env.ADMIN_PASSWORD;

if (!adminPassword) {
  console.log('ADMIN_PASSWORD not set; skipping admin user creation');
} else if (!validator.isEmail(adminUsername)) {
  console.log('ADMIN_USERNAME must be an email address; skipping admin user creation');
} else {
  User.findOne({ username: adminUsername }, function (err, user) {
    if (err) {
      console.log(err);
      return;
    }

    if (!user) {
      new User({ username: adminUsername, password: adminPassword }).save(function (err) {
        if (err) {
          console.log('error saving admin user');
        }
      });
    } else {
      passwordHash.verifyPassword(adminPassword, user.password, function (err, verified) {
        if (err) {
          console.log(err);
          return;
        }
        if (verified) return;

        user.password = adminPassword;
        user.markModified('password');
        user.save(function (err) {
          if (err) {
            console.log('error saving admin user');
          }
        });
      });
    }
  });
}