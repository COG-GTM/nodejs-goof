const mongoose = require('mongoose');

// routes/index.js resolves the Todo and User models at require time. Register
// the schemas here so the route handlers can be loaded without mongoose-db.js,
// which also opens a connection to MongoDB.
function registerModels() {
  if (!mongoose.modelNames().includes('Todo')) {
    mongoose.model('Todo', new mongoose.Schema({ content: Buffer, updated_at: Date }));
  }
  if (!mongoose.modelNames().includes('User')) {
    mongoose.model('User', new mongoose.Schema({ username: String, password: String }));
  }
}

function fakeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    rendered: null,
    redirectedTo: null,
    body: undefined,
    ended: false,
    status(code) {
      res.statusCode = code;
      return res;
    },
    setHeader(name, value) {
      res.headers[name] = value;
    },
    render(view, locals) {
      res.rendered = { view, locals };
      return res;
    },
    redirect(url) {
      res.redirectedTo = url;
      return res;
    },
    send(body) {
      res.body = body;
      return res;
    },
    end(body) {
      res.ended = true;
      res.body = body;
      return res;
    },
  };
  return res;
}

module.exports = { registerModels, fakeRes };
