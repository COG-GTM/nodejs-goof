/**
 * Minimal, dependency-free error-tracking and request-outcome metrics layer.
 *
 * Exposes:
 *   requestMetrics()  - per-request outcome counter + duration histogram
 *   errorTracker()    - terminal error middleware: structured error events + failure counter
 *   metricsHandler    - Prometheus text exposition of the collected series
 *   captureException  - manual reporting hook for handlers that swallow errors
 */

var DURATION_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

var requestCounter = Object.create(null);
var durationSeries = Object.create(null);
var errorCounter = Object.create(null);

function labelKey(labels) {
  return Object.keys(labels)
    .sort()
    .map(function (name) {
      return name + '=' + String(labels[name]);
    })
    .join('|');
}

function increment(store, labels) {
  var key = labelKey(labels);
  if (!store[key]) store[key] = { labels: labels, value: 0 };
  store[key].value += 1;
}

function observeDuration(labels, seconds) {
  var key = labelKey(labels);
  if (!durationSeries[key]) {
    durationSeries[key] = {
      labels: labels,
      count: 0,
      sum: 0,
      buckets: DURATION_BUCKETS.map(function () {
        return 0;
      })
    };
  }
  var series = durationSeries[key];
  series.count += 1;
  series.sum += seconds;
  DURATION_BUCKETS.forEach(function (bound, i) {
    if (seconds <= bound) series.buckets[i] += 1;
  });
}

// Route pattern (never the raw URL) keeps metric cardinality bounded and avoids
// leaking identifiers from the path.
function routeOf(req) {
  if (req.route && req.route.path) {
    return (req.baseUrl || '') + req.route.path;
  }
  return 'unmatched';
}

function emit(event) {
  event.timestamp = new Date().toISOString();
  var line = JSON.stringify(event);
  if (event.level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

function requestMetrics() {
  return function (req, res, next) {
    var start = process.hrtime();
    res.on('finish', function () {
      var diff = process.hrtime(start);
      var seconds = diff[0] + diff[1] / 1e9;
      var labels = {
        method: req.method,
        route: routeOf(req),
        status: String(res.statusCode)
      };
      increment(requestCounter, labels);
      observeDuration({ method: labels.method, route: labels.route }, seconds);
      if (res.statusCode >= 500) {
        emit({
          level: 'error',
          event: 'http_request_failed',
          method: labels.method,
          route: labels.route,
          statusCode: res.statusCode,
          durationMs: Math.round(seconds * 1000)
        });
      }
    });
    next();
  };
}

// Request bodies, query strings and headers are deliberately never recorded:
// they carry credentials and PII in this application.
function captureException(err, context) {
  var details = context || {};
  increment(errorCounter, {
    route: details.route || 'unknown',
    method: details.method || 'unknown',
    error: (err && err.name) || 'Error'
  });
  emit({
    level: 'error',
    event: details.event || 'unhandled_error',
    method: details.method,
    route: details.route,
    statusCode: details.statusCode,
    errorName: (err && err.name) || 'Error',
    errorMessage: err && err.message,
    stack: err && err.stack
  });
}

function errorTracker() {
  return function (err, req, res, next) {
    captureException(err, {
      event: 'request_handler_error',
      method: req.method,
      route: routeOf(req),
      statusCode: err && err.status ? err.status : 500
    });
    next(err);
  };
}

function metricsHandler(req, res) {
  var lines = [];

  lines.push('# HELP http_requests_total Total HTTP requests by method, route and status.');
  lines.push('# TYPE http_requests_total counter');
  Object.keys(requestCounter).forEach(function (key) {
    var series = requestCounter[key];
    lines.push('http_requests_total{' + renderLabels(series.labels) + '} ' + series.value);
  });

  lines.push('# HELP http_request_duration_seconds Request duration by method and route.');
  lines.push('# TYPE http_request_duration_seconds histogram');
  Object.keys(durationSeries).forEach(function (key) {
    var series = durationSeries[key];
    var base = renderLabels(series.labels);
    DURATION_BUCKETS.forEach(function (bound, i) {
      lines.push(
        'http_request_duration_seconds_bucket{' + base + ',le="' + bound + '"} ' + series.buckets[i]
      );
    });
    lines.push('http_request_duration_seconds_bucket{' + base + ',le="+Inf"} ' + series.count);
    lines.push('http_request_duration_seconds_sum{' + base + '} ' + series.sum);
    lines.push('http_request_duration_seconds_count{' + base + '} ' + series.count);
  });

  lines.push('# HELP http_handler_errors_total Errors reported to the error tracker.');
  lines.push('# TYPE http_handler_errors_total counter');
  Object.keys(errorCounter).forEach(function (key) {
    var series = errorCounter[key];
    lines.push('http_handler_errors_total{' + renderLabels(series.labels) + '} ' + series.value);
  });

  var body = lines.join('\n') + '\n';
  res.writeHead(200, {
    'Content-Type': 'text/plain; version=0.0.4',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function renderLabels(labels) {
  return Object.keys(labels)
    .sort()
    .map(function (name) {
      return name + '="' + String(labels[name]).replace(/(["\\])/g, '\\$1') + '"';
    })
    .join(',');
}

module.exports = {
  requestMetrics: requestMetrics,
  errorTracker: errorTracker,
  captureException: captureException,
  metricsHandler: metricsHandler
};
