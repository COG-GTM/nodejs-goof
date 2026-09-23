/**
 * Minimal structured telemetry helper.
 *
 * Emits one JSON object per line on stdout so events can be shipped to a log
 * or metrics backend, and keeps in-process counters that can be scraped or
 * logged for alerting (e.g. brute-force detection on failed logins).
 */

var counters = Object.create(null);

function increment(metric, tags) {
  var key = metric;
  if (tags) {
    var suffix = Object.keys(tags)
      .sort()
      .map(function (name) {
        return name + '=' + tags[name];
      })
      .join(',');
    if (suffix) key = metric + '{' + suffix + '}';
  }
  counters[key] = (counters[key] || 0) + 1;
  return counters[key];
}

function getCounters() {
  return Object.assign({}, counters);
}

function emit(event, fields) {
  var payload = Object.assign(
    {
      timestamp: new Date().toISOString(),
      event: event,
    },
    fields || {}
  );
  console.log(JSON.stringify(payload));
  return payload;
}

function sourceIp(req) {
  if (!req) return undefined;
  var forwarded = req.headers && req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return req.ip || (req.connection && req.connection.remoteAddress);
}

module.exports = {
  emit: emit,
  increment: increment,
  getCounters: getCounters,
  sourceIp: sourceIp,
};
