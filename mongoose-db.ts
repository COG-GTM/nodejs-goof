import mongoose = require('mongoose');
import cfenv = require("cfenv");

export interface TodoDocument {
  _id: unknown;
  content: Buffer | string;
  updated_at: Date | number;
  save(callback: (err: Error | null, todo: TodoDocument, count?: number) => void): void;
  remove(callback: (err: Error | null, todo: TodoDocument) => void): void;
}

export interface UserDocument {
  username: string;
  password: string;
  save(callback: (err: Error | null, user: UserDocument, count?: number) => void): void;
}

var Schema = mongoose.Schema;

var Todo = new Schema({
  content: Buffer,
  updated_at: Date,
});

mongoose.model('Todo', Todo);

var UserSchema = new Schema({
  username: String,
  password: String,
});

mongoose.model('User', UserSchema);

// CloudFoundry env vars
var mongoCFUri: string | undefined = cfenv.getAppEnv().getServiceURL('goof-mongo');
console.log(JSON.stringify(cfenv.getAppEnv()));

// Default Mongo URI is local
const DOCKER = process.env.DOCKER
let mongoUri: string;
if (DOCKER === '1') {
  mongoUri = 'mongodb://goof-mongo/express-todo';
} else {
  mongoUri = 'mongodb://localhost/express-todo';
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

var User = mongoose.model('User');
User.find({ username: 'admin@snyk.io' }).exec(function (err: Error | null, users: UserDocument[]) {
  console.log(users);
  if (users.length === 0) {
    console.log('no admin');
    new User({ username: 'admin@snyk.io', password: 'SuperSecretPassword' }).save(function (err: Error | null, user: UserDocument, count?: number) {
      if (err) {
        console.log('error saving admin user');
      }
    });
  }
});
