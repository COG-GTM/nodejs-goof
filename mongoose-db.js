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


var mongoOptions = {};

// CloudFoundry Mongo URI
if (mongoCFUri) {
  mongoUri = mongoCFUri;
} else if (process.env.MONGOLAB_URI) {
  // Generic (plus Heroku) env var support
  mongoUri = process.env.MONGOLAB_URI;
} else if (process.env.MONGODB_URI) {
  // Generic (plus Heroku) env var support
  mongoUri = process.env.MONGODB_URI;
} else if (process.env.MONGO_HOST) {
  // Platform: separate connection-secret fields; credentials go in options so reserved characters need no URI escaping
  mongoUri = 'mongodb://' + process.env.MONGO_HOST + ':' + (process.env.MONGO_PORT || '27017') + '/' +
    (process.env.MONGO_DATABASE || 'express-todo');
  if (process.env.MONGO_USER) {
    mongoOptions = {
      user: process.env.MONGO_USER,
      pass: process.env.MONGO_PASSWORD || '',
      auth: { authSource: process.env.MONGO_AUTH_SOURCE || 'admin' }
    };
  }
}

console.log("Using Mongo URI " + mongoUri.replace(/\/\/[^@\/]*@/, '//***@'));

mongoose.connect(mongoUri, mongoOptions);

User = mongoose.model('User');
User.find({ username: 'admin@snyk.io' }).exec(function (err, users) {
  console.log(users);
  if (users.length === 0) {
    console.log('no admin');
    new User({ username: 'admin@snyk.io', password: 'SuperSecretPassword' }).save(function (err, user, count) {
      if (err) {
        console.log('error saving admin user');
      }
    });
  }
});