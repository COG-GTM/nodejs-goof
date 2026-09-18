// Minimal HTTP client for the integration tests: starts the app on an
// ephemeral port and keeps the session cookie between requests.

function startServer(app) {
  return new Promise(function (resolve) {
    var server = app.listen(0, '127.0.0.1', function () {
      resolve(server);
    });
  });
}

function stopServer(server) {
  return new Promise(function (resolve) {
    server.close(resolve);
    server.closeAllConnections();
  });
}

function createClient(server) {
  var baseUrl = 'http://127.0.0.1:' + server.address().port;
  var cookie = null;

  function remember(response) {
    var setCookie = response.headers.getSetCookie
      ? response.headers.getSetCookie()
      : [].concat(response.headers.get('set-cookie') || []);
    setCookie.forEach(function (value) {
      cookie = value.split(';')[0];
    });
  }

  function request(method, url, options) {
    var opts = options || {};
    var headers = Object.assign({}, opts.headers);
    if (cookie) headers.cookie = cookie;

    return fetch(baseUrl + url, {
      method: method,
      headers: headers,
      body: opts.body,
      redirect: 'manual',
    }).then(function (response) {
      remember(response);
      return response;
    });
  }

  return {
    get: function (url) {
      return request('GET', url);
    },
    postForm: function (url, fields) {
      return request('POST', url, {
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fields).toString(),
      });
    },
    hasCookie: function () {
      return cookie !== null;
    },
  };
}

module.exports = {
  startServer: startServer,
  stopServer: stopServer,
  createClient: createClient,
};
