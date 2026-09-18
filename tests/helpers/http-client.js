var http = require('http');

// Boots the express app from app.js on an ephemeral port and returns a small
// client that keeps cookies between requests so session-based flows work.
function startServer(app, callback) {
  var server = http.createServer(app);
  server.listen(0, '127.0.0.1', function () {
    callback(createClient(server.address().port), server);
  });
}

// A fresh client has an empty cookie jar, i.e. an anonymous session.
function createClient(port) {
  return new Client(port);
}

function Client(port) {
  this.port = port;
  this.cookies = {};
}

Client.prototype.storeCookies = function (res) {
  var setCookie = res.headers['set-cookie'] || [];
  var self = this;
  setCookie.forEach(function (cookie) {
    var pair = cookie.split(';')[0];
    var name = pair.slice(0, pair.indexOf('='));
    self.cookies[name] = pair;
  });
};

Client.prototype.cookieHeader = function () {
  var self = this;
  return Object.keys(this.cookies).map(function (name) {
    return self.cookies[name];
  }).join('; ');
};

Client.prototype.request = function (method, path, options) {
  var self = this;
  options = options || {};
  var headers = Object.assign({}, options.headers);
  var body;

  if (options.json !== undefined) {
    body = JSON.stringify(options.json);
    headers['content-type'] = 'application/json';
  } else if (options.form !== undefined) {
    body = new URLSearchParams(options.form).toString();
    headers['content-type'] = 'application/x-www-form-urlencoded';
  }

  if (body !== undefined) {
    headers['content-length'] = Buffer.byteLength(body);
  }

  var cookies = this.cookieHeader();
  if (cookies) {
    headers.cookie = cookies;
  }

  return new Promise(function (resolve, reject) {
    var req = http.request({
      host: '127.0.0.1',
      port: self.port,
      method: method,
      path: path,
      headers: headers
    }, function (res) {
      var chunks = [];
      res.on('data', function (chunk) { chunks.push(chunk); });
      res.on('end', function () {
        self.storeCookies(res);
        var text = Buffer.concat(chunks).toString('utf8');
        resolve({
          status: res.statusCode,
          headers: res.headers,
          text: text,
          json: function () { return JSON.parse(text); }
        });
      });
    });
    req.on('error', reject);
    if (body !== undefined) {
      req.write(body);
    }
    req.end();
  });
};

['get', 'post', 'put', 'delete'].forEach(function (method) {
  Client.prototype[method] = function (path, options) {
    return this.request(method.toUpperCase(), path, options);
  };
});

module.exports = { startServer: startServer, createClient: createClient };
