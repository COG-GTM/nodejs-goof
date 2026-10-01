var mongoose = require('mongoose');
var cfenv = require("cfenv");
var passwordHash = require('./password-hash');
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
  var user = this;
  if (!user.isModified('password') || passwordHash.isHash(user.password)) {
    return next();
  }
  passwordHash.hash(user.password, function (err, hashed) {
    if (err) return next(err);
    user.password = hashed;
    next();
  });
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

function hashLegacyPasswords(callback) {
  User.find({}).exec(function (err, users) {
    if (err) return callback(err);
    var pending = users.filter(function (user) {
      return typeof user.password === 'string' && !passwordHash.isHash(user.password);
    });
    var remaining = pending.length;
    if (remaining === 0) return callback();
    var failed = null;
    pending.forEach(function (user) {
      user.markModified('password');
      user.save(function (err) {
        if (err) failed = err;
        if (--remaining === 0) callback(failed);
      });
    });
  });
}

function seedAdmin() {
  User.find({ username: 'admin@snyk.io' }).exec(function (err, users) {
    if (err) {
      console.log('error looking up admin user');
      return;
    }
    if (users.length > 0) return;
    var adminPassword = process.env.GOOF_ADMIN_PASSWORD;
    if (!adminPassword) {
      console.log('no admin user and GOOF_ADMIN_PASSWORD is not set; skipping admin seed');
      return;
    }
    new User({ username: 'admin@snyk.io', password: adminPassword }).save(function (err) {
      if (err) {
        console.log('error saving admin user');
      }
    });
  });
}

hashLegacyPasswords(function (err) {
  if (err) {
    console.log('error hashing legacy user passwords');
  }
  seedAdmin();
});
