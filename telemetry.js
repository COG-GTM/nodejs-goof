/**
 * Minimal telemetry sink: emits single-line JSON events, errors and metrics on
 * stderr so a log shipper can index and alert on them.
 */

var counters = Object.create(null);
var gauges = Object.create(null);

function emit(record) {
  record.timestamp = new Date().toISOString();
  record.service = process.env.SERVICE_NAME || 'nodejs-goof';
  try {
    process.stderr.write(JSON.stringify(record) + '\n');
  } catch (e) {
    process.stderr.write('{"level":"error","message":"telemetry serialization failed"}\n');
  }
}

function recordEvent(name, fields) {
  emit({ level: 'info', type: 'event', event: name, fields: fields || {} });
}

function captureError(name, error, fields) {
  emit({
    level: 'error',
    type: 'error',
    event: name,
    error: {
      message: error && error.message ? error.message : String(error),
      name: error && error.name,
      stack: error && error.stack,
    },
    fields: fields || {},
  });
}

function incrementCounter(name, fields) {
  counters[name] = (counters[name] || 0) + 1;
  emit({ level: 'info', type: 'counter', metric: name, value: counters[name], fields: fields || {} });
}

function setGauge(name, value, fields) {
  gauges[name] = value;
  emit({ level: 'info', type: 'gauge', metric: name, value: value, fields: fields || {} });
}

module.exports = {
  recordEvent: recordEvent,
  captureError: captureError,
  incrementCounter: incrementCounter,
  setGauge: setGauge,
  counters: counters,
  gauges: gauges,
};
