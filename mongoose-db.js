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
  passwordHash: String,
  passwordSalt: String,
});

function scrypt(password, salt) {
  return new Promise(function (resolve, reject) {
    crypto.scrypt(password, salt, 64, function (err, key) {
      if (err) return reject(err);
      resolve(key);
    });
  });
}

User.methods.setPassword = async function (password) {
  this.passwordSalt = crypto.randomBytes(16).toString('hex');
  this.passwordHash = (await scrypt(password, this.passwordSalt)).toString('hex');
};

User.methods.verifyPassword = async function (password) {
  if (!this.passwordHash || !this.passwordSalt) return false;
  var expected = Buffer.from(this.passwordHash, 'hex');
  var actual = await scrypt(password, this.passwordSalt);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

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

console.log("Using Mongo URI " + mongoUri);

User = mongoose.model('User');

async function seedAdmin() {
  var adminUsername = process.env.ADMIN_USERNAME;
  if (!adminUsername) {
    console.log('ADMIN_USERNAME not set; skipping admin user seed');
    return;
  }
  var existing = await User.findOne({ username: adminUsername }).exec();
  if (existing) return;
  console.log('no admin');
  var password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = crypto.randomBytes(12).toString('base64url');
    console.log('ADMIN_PASSWORD not set; generated admin password: ' + password);
  }
  var admin = new User({ username: adminUsername });
  await admin.setPassword(password);
  await admin.save();
}

mongoose.connect(mongoUri)
  .then(seedAdmin)
  .catch(function (err) {
    console.log('error connecting to MongoDB or seeding admin user');
    console.error(err);
  });
