// Minimal express-like response double recording what a handler sent.
// `whenEnded` resolves once the handler answered, which mongoose hooks make
// asynchronous even when the model callbacks are stubbed.
function fakeRes() {
  var end;
  var res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    redirectedTo: undefined,
    ended: false,
    status: function (code) {
      res.statusCode = code;
      return res;
    },
    setHeader: function (name, value) {
      res.headers[name] = value;
      return res;
    },
    send: function (body) {
      res.body = body;
      return finish();
    },
    redirect: function (url) {
      res.redirectedTo = url;
      return finish();
    },
    render: function (view, locals) {
      res.body = { view: view, locals: locals };
      return finish();
    },
  };

  res.whenEnded = new Promise(function (resolve) {
    end = resolve;
  });

  function finish() {
    res.ended = true;
    end(res);
    return res;
  }

  return res;
}

function fakeReq(options) {
  options = options || {};
  return {
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    files: options.files,
  };
}

// Resolves once `predicate` holds, so tests can wait for the todos a handler
// saves after it has already responded.
function waitFor(predicate, timeoutMs) {
  var deadline = Date.now() + (timeoutMs || 5000);
  return new Promise(function (resolve, reject) {
    (function poll() {
      if (predicate()) return resolve();
      if (Date.now() > deadline) return reject(new Error('timed out waiting for condition'));
      setTimeout(poll, 5);
    })();
  });
}

module.exports = { fakeReq: fakeReq, fakeRes: fakeRes, waitFor: waitFor };
