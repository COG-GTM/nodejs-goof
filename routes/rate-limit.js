'use strict';

// Dependency-free, in-memory fixed-window rate limiter.
// Keyed by client IP; expired buckets are swept lazily on each request.

var DEFAULT_WINDOW_MS = 60 * 1000;
var DEFAULT_MAX = 30;
var SWEEP_INTERVAL_MS = 5 * 60 * 1000;

function clientKey(req) {
  return (req.ip || (req.connection && req.connection.remoteAddress) || 'unknown').toString();
}

function rateLimit(options) {
  var opts = options || {};
  var windowMs = opts.windowMs || DEFAULT_WINDOW_MS;
  var max = opts.max || DEFAULT_MAX;
  var message = opts.message || 'Too many requests, please try again later.';

  var buckets = new Map();
  var lastSweep = Date.now();

  function sweep(now) {
    if (now - lastSweep < SWEEP_INTERVAL_MS) return;
    lastSweep = now;
    buckets.forEach(function (bucket, key) {
      if (now >= bucket.resetAt) buckets.delete(key);
    });
  }

  return function limiter(req, res, next) {
    var now = Date.now();
    sweep(now);

    var key = clientKey(req);
    var bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    var remaining = Math.max(0, max - bucket.count);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      return res.status(429).send(message);
    }

    return next();
  };
}

// Wraps a single route handler with its own limiter, so throttling can be
// applied without touching the route table.
function throttle(options, handler) {
  var limiter = rateLimit(options);
  return function throttled(req, res, next) {
    return limiter(req, res, function (err) {
      if (err) return next(err);
      return handler(req, res, next);
    });
  };
}

module.exports = { rateLimit: rateLimit, throttle: throttle };
