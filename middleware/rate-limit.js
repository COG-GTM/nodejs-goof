var buckets = new Map();

function clientKey(req) {
  return req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
}

// Fixed-window in-memory limiter: at most `max` requests per `windowMs` per client IP.
module.exports = function rateLimit(options) {
  var windowMs = (options && options.windowMs) || 60 * 1000;
  var max = (options && options.max) || 60;
  var cleanup = setInterval(function () {
    var now = Date.now();
    buckets.forEach(function (entry, key) {
      if (now - entry.start >= windowMs) {
        buckets.delete(key);
      }
    });
  }, windowMs);
  if (cleanup.unref) cleanup.unref();

  return function (req, res, next) {
    var now = Date.now();
    var key = clientKey(req);
    var entry = buckets.get(key);
    if (!entry || now - entry.start >= windowMs) {
      entry = { start: now, count: 0 };
      buckets.set(key, entry);
    }
    if (buckets.size > 10000) {
      buckets.forEach(function (entry, key) {
        if (now - entry.start >= windowMs) {
          buckets.delete(key);
        }
      });
    }
    entry.count++;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.start + windowMs - now) / 1000)));
      return res.status(429).send('Too Many Requests');
    }
    return next();
  };
};
