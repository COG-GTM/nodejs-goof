var mongoose = require('mongoose');
var cfenv = require("cfenv");
var telemetry = require('./telemetry');
var Schema = mongoose.Schema;

// Host only: the URI may carry credentials that must never be reported.
function mongoHost(uri) {
  var match = /^mongodb(?:\+srv)?:\/\/(?:[^@\/]*@)?([^\/?]+)/.exec(uri || '');
  return match ? match[1] : 'unknown';
}

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

var mongoHostname = mongoHost(mongoUri);
console.log("Using Mongo URI " + mongoUri);

telemetry.setGauge('db_connected', 0, { host: mongoHostname });

mongoose.connection.on('error', function (err) {
  telemetry.setGauge('db_connected', 0, { host: mongoHostname });
  telemetry.recordEvent('db.connection', { outcome: 'error', host: mongoHostname });
  telemetry.captureError('db.connection_error', err, { host: mongoHostname });
});

mongoose.connection.on('connected', function () {
  telemetry.setGauge('db_connected', 1, { host: mongoHostname });
  telemetry.recordEvent('db.connection', { outcome: 'connected', host: mongoHostname });
});

mongoose.connection.on('disconnected', function () {
  telemetry.setGauge('db_connected', 0, { host: mongoHostname });
  telemetry.recordEvent('db.connection', { outcome: 'disconnected', host: mongoHostname });
});

mongoose.connect(mongoUri, function (err) {
  if (err) {
    telemetry.setGauge('db_connected', 0, { host: mongoHostname });
    telemetry.recordEvent('db.connection', { outcome: 'failed', host: mongoHostname });
    telemetry.captureError('db.connection_failed', err, { host: mongoHostname });
  }
});

User = mongoose.model('User');
User.find({ username: 'admin@snyk.io' }).exec(function (err, users) {
  if (err) {
    telemetry.incrementCounter('db.admin_bootstrap_failed', { stage: 'lookup' });
    telemetry.captureError('db.admin_bootstrap_error', err, { stage: 'lookup', host: mongoHostname });
    return;
  }
  console.log(users);
  if (users.length === 0) {
    console.log('no admin');
    new User({ username: 'admin@snyk.io', password: 'SuperSecretPassword' }).save(function (err, user, count) {
      if (err) {
        telemetry.incrementCounter('db.admin_bootstrap_failed', { stage: 'save' });
        telemetry.captureError('db.admin_bootstrap_error', err, { stage: 'save', host: mongoHostname });
        return;
      }
      telemetry.recordEvent('db.admin_bootstrap', { outcome: 'created' });
    });
  }
});