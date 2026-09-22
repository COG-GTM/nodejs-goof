var crypto = require('crypto');
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

mongoose.connect(mongoUri).then(function () {
  var UserModel = mongoose.model('User');
  return UserModel.find({ username: 'admin@snyk.io' }).then(function (users) {
    if (users.length > 0) {
      return null;
    }

    // The seeded admin password is taken from the environment; a random one is
    // generated when it is not provided so that no credential is committed.
    var adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(24).toString('hex');
    if (!process.env.ADMIN_PASSWORD) {
      console.log('ADMIN_PASSWORD is not set, seeding the admin user with a random password');
    }

    return new UserModel({ username: 'admin@snyk.io', password: adminPassword }).save();
  });
}).catch(function (err) {
  console.log('error connecting to mongo or seeding the admin user');
  console.error(err);
});
