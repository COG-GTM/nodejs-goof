/**
 * Production error tracking for state-changing routes.
 *
 * Emits one structured JSON record per failed request and keeps a per-route
 * error counter so write-path failure rates can be scraped or alerted on.
 */

var errorCounts = Object.create(null);

function routeKey(req) {
  var route = (req.route && req.route.path) || req.path || 'unknown';
  return (req.method || 'UNKNOWN') + ' ' + route;
}

function statusFor(err, res) {
  if (err && (err.status || err.statusCode)) {
    return err.status || err.statusCode;
  }
  if (res.statusCode && res.statusCode >= 400) {
    return res.statusCode;
  }
  return 500;
}

function recordError(req, err, status) {
  var key = routeKey(req);
  errorCounts[key] = (errorCounts[key] || 0) + 1;
  return { key: key, count: errorCounts[key], status: status };
}

function getErrorMetrics() {
  return Object.assign({}, errorCounts);
}

function resetErrorMetrics() {
  errorCounts = Object.create(null);
}

function errorTracker(err, req, res, next) {
  var status = statusFor(err, res);
  var metric = recordError(req, err, status);

  console.error(JSON.stringify({
    level: 'error',
    event: 'request_error',
    timestamp: new Date().toISOString(),
    method: req.method,
    route: (req.route && req.route.path) || req.path,
    url: req.originalUrl || req.url,
    status: status,
    error_type: (err && err.name) || typeof err,
    error_message: (err && err.message) || String(err),
    stack: err && err.stack,
    error_count: metric.count
  }));

  next(err);
}

module.exports = {
  errorTracker: errorTracker,
  getErrorMetrics: getErrorMetrics,
  resetErrorMetrics: resetErrorMetrics
};
