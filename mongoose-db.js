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

var adminUsername = process.env.GOOF_ADMIN_USERNAME || 'admin@snyk.io';
var adminPassword = process.env.GOOF_ADMIN_PASSWORD;

if (!adminPassword) {
  console.log('GOOF_ADMIN_PASSWORD is not set; skipping admin user seeding');
} else {
  User.find({ username: adminUsername }).exec(function (err, users) {
    if (err) {
      console.log('error looking up admin user');
      return;
    }
    if (users.length === 0) {
      console.log('no admin, creating ' + adminUsername);
      new User({ username: adminUsername, password: adminPassword }).save(function (err, user, count) {
        if (err) {
          console.log('error saving admin user');
        }
      });
    }
  });
}
