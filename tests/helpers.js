const path = require('path');
const mongoose = require('mongoose');

// Register the schemas without connecting to a database so that
// routes/index.js can be required in isolation.
if (!mongoose.models.Todo) {
  mongoose.model('Todo', new mongoose.Schema({ content: Buffer, updated_at: Date }));
}
if (!mongoose.models.User) {
  mongoose.model('User', new mongoose.Schema({ username: String, password: String }));
}

// Stub the TypeORM DataSource module so routes/users.js never opens a MySQL
// connection during unit tests.
const typeormDbPath = require.resolve(path.join(__dirname, '..', 'typeorm-db.js'));
const fakeRepo = {
  calls: [],
  async find(opts) { this.calls.push(['find', opts]); return []; },
  async save(entity) { this.calls.push(['save', entity]); return entity; },
};
require.cache[typeormDbPath] = {
  id: typeormDbPath,
  filename: typeormDbPath,
  loaded: true,
  exports: { getRepository: () => fakeRepo },
};

function mockRes() {
  let done;
  const finished = new Promise((resolve) => { done = resolve; });
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    redirectedTo: undefined,
    rendered: undefined,
    finished,
    _done: done,
    status(code) { this.statusCode = code; return this; },
    setHeader(k, v) { this.headers[k] = v; },
    send(body) { this.body = body; this._done(this); return this; },
    json(body) { this.body = body; this._done(this); return this; },
    sendStatus(code) { this.statusCode = code; this._done(this); return this; },
    redirect(url) { this.statusCode = 302; this.redirectedTo = url; this._done(this); return this; },
    render(view, locals) { this.rendered = { view, locals }; this._done(this); return this; },
  };
  return res;
}

// Runs an express Router against a fake request and resolves with the fake response.
function runRouter(router, method, url, body) {
  const req = { method, url, body, headers: {}, query: {}, params: {}, session: {} };
  const res = mockRes();
  return new Promise((resolve, reject) => {
    res.finished.then(resolve);
    router.handle(req, res, (err) => (err ? reject(err) : resolve(res)));
  });
}

module.exports = { mockRes, runRouter, fakeRepo };
