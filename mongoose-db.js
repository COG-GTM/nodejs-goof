var mongoose = require('mongoose');
var cfenv = require("cfenv");
var bcrypt = require('bcryptjs');
var Schema = mongoose.Schema;

var Todo = new Schema({
  content: Buffer,
  updated_at: Date,
});

mongoose.model('Todo', Todo);

var BCRYPT_ROUNDS = 12;
var MIN_PASSWORD_LENGTH = 12;
var BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

function isPasswordHash(value) {
  return typeof value === 'string' && BCRYPT_HASH_PATTERN.test(value);
}

var User = new Schema({
  username: String,
  // bcrypt hash; never a plaintext password
  password: String,
  mustChangePassword: { type: Boolean, default: false },
});

User.statics.MIN_PASSWORD_LENGTH = MIN_PASSWORD_LENGTH;

User.statics.hashPassword = function (plainPassword) {
  return bcrypt.hashSync(plainPassword, BCRYPT_ROUNDS);
};

User.methods.verifyPassword = function (candidate, cb) {
  if (typeof candidate !== 'string' || !isPasswordHash(this.password)) {
    return process.nextTick(function () { cb(null, false); });
  }
  bcrypt.compare(candidate, this.password, cb);
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

// The admin account is provisioned from GOOF_ADMIN_PASSWORD at deploy time and
// must change its password on first login. Without it, no admin is created.
var ADMIN_USERNAME = 'admin@snyk.io';
var initialAdminPassword = process.env.GOOF_ADMIN_PASSWORD;

User.findOne({ username: ADMIN_USERNAME }).exec(function (err, admin) {
  if (err) {
    console.log('error looking up admin user');
    return;
  }
  if (admin && isPasswordHash(admin.password)) {
    return;
  }

  if (!initialAdminPassword || initialAdminPassword.length < MIN_PASSWORD_LENGTH) {
    console.log('GOOF_ADMIN_PASSWORD is not set (or shorter than ' + MIN_PASSWORD_LENGTH +
      ' characters); admin account not provisioned');
    if (admin) {
      // Disable a legacy admin whose password was stored in plaintext.
      admin.password = undefined;
      admin.save(function (err) {
        if (err) {
          console.log('error disabling legacy admin user');
        }
      });
    }
    return;
  }

  admin = admin || new User({ username: ADMIN_USERNAME });
  admin.password = User.hashPassword(initialAdminPassword);
  admin.mustChangePassword = true;
  admin.save(function (err) {
    if (err) {
      console.log('error saving admin user');
    }
  });
});
