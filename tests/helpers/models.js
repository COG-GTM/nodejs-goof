// Registers the mongoose models the routes bind at require time, without
// opening a database connection.
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

if (!mongoose.models.Todo) {
  mongoose.model('Todo', new Schema({
    content: Buffer,
    updated_at: Date,
  }));
}

if (!mongoose.models.User) {
  mongoose.model('User', new Schema({
    username: String,
    password: String,
  }));
}

module.exports = {
  Todo: mongoose.model('Todo'),
  User: mongoose.model('User'),
};
