var crypto = require('crypto');
var os = require('os');

var SERVICE_NAME = process.env.TELEMETRY_SERVICE_NAME || 'goof';
var counters = new Map();

function labelKey(name, labels) {
  var parts = Object.keys(labels).sort().map(function (label) {
    return label + '=' + labels[label];
  });
  return name + '{' + parts.join(',') + '}';
}

function increment(name, labels, value) {
  var key = labelKey(name, labels || {});
  var counter = counters.get(key);
  if (!counter) {
    counter = { name: name, labels: labels || {}, value: 0 };
    counters.set(key, counter);
  }
  counter.value += value === undefined ? 1 : value;
  return counter.value;
}

function snapshot() {
  return Array.from(counters.values()).map(function (counter) {
    return { name: counter.name, labels: counter.labels, value: counter.value };
  });
}

function escapeLabelValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

// Prometheus text exposition format, so a failed-login counter can be scraped
// and alerted on.
function renderMetrics() {
  var families = new Map();

  snapshot().forEach(function (counter) {
    if (!families.has(counter.name)) {
      families.set(counter.name, []);
    }
    var labels = Object.keys(counter.labels).sort().map(function (label) {
      return label + '="' + escapeLabelValue(counter.labels[label]) + '"';
    });
    var suffix = labels.length ? '{' + labels.join(',') + '}' : '';
    families.get(counter.name).push(counter.name + suffix + ' ' + counter.value);
  });

  var lines = [];
  families.forEach(function (samples, name) {
    lines.push('# TYPE ' + name + ' counter');
    lines = lines.concat(samples);
  });

  return lines.join('\n') + '\n';
}

// One JSON object per line on stdout so any log shipper can index the events.
function emit(event, level, properties) {
  var record = Object.assign(
    {
      timestamp: new Date().toISOString(),
      level: level,
      event: event,
      service: SERVICE_NAME,
      host: os.hostname()
    },
    properties || {}
  );
  process.stdout.write(JSON.stringify(record) + '\n');
  return record;
}

function hashUsername(username) {
  if (typeof username !== 'string' || username.length === 0) {
    return null;
  }
  return crypto.createHash('sha256').update(username).digest('hex');
}

function requestContext(req) {
  return {
    sourceIp: (req && req.ip) || null,
    userAgent: (req && req.headers && req.headers['user-agent']) || null
  };
}

function loginSucceeded(req, username) {
  increment('login_succeeded_total', {});
  return emit(
    'login_succeeded',
    'info',
    Object.assign({ username: username }, requestContext(req))
  );
}

function loginFailed(req, reason, username) {
  increment('login_failed_total', { reason: reason });
  return emit(
    'login_failed',
    'warn',
    Object.assign({ reason: reason, usernameHash: hashUsername(username) }, requestContext(req))
  );
}

function metricsHandler(req, res) {
  res.set('Content-Type', 'text/plain; version=0.0.4');
  return res.send(renderMetrics());
}

module.exports = {
  emit: emit,
  increment: increment,
  snapshot: snapshot,
  renderMetrics: renderMetrics,
  hashUsername: hashUsername,
  loginSucceeded: loginSucceeded,
  loginFailed: loginFailed,
  metricsHandler: metricsHandler
};
