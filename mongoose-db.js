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

// Hosts and database name only; never userinfo or query options
function describeMongoUri(uri) {
  var match = /^[a-z0-9+.-]+:\/\/([^\/?#]*)(?:\/([^?#]*))?/i.exec(String(uri || ''));
  if (!match) {
    return 'an unparseable Mongo URI';
  }
  var hosts = match[1].slice(match[1].lastIndexOf('@') + 1) || '(none)';
  var database = match[2] || '(default)';
  return 'Mongo host(s) ' + hosts + ', database ' + database;
}

console.log('Using ' + describeMongoUri(mongoUri));

mongoose.connect(mongoUri);

User = mongoose.model('User');
User.find({ username: 'admin@snyk.io' }).exec(function (err, users) {
  console.log('admin user lookup returned ' + (users ? users.length : 0) + ' record(s)');
  if (users.length === 0) {
    console.log('no admin');
    new User({ username: 'admin@snyk.io', password: 'SuperSecretPassword' }).save(function (err, user, count) {
      if (err) {
        console.log('error saving admin user');
      }
    });
  }
});

module.exports.describeMongoUri = describeMongoUri;