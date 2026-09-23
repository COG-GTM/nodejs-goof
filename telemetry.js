'use strict';

var counters = Object.create(null);

function emit(level, event, fields) {
  var record = {
    timestamp: new Date().toISOString(),
    level: level,
    event: event
  };

  if (fields) {
    Object.keys(fields).forEach(function (key) {
      record[key] = fields[key];
    });
  }

  var line = JSON.stringify(record);
  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

function auditEvent(event, fields) {
  emit('info', event, fields);
}

function trackError(event, err, fields) {
  var payload = {
    error_message: err && err.message ? err.message : String(err),
    error_name: err && err.name ? err.name : 'Error',
    stack: err && err.stack ? err.stack : undefined
  };

  if (fields) {
    Object.keys(fields).forEach(function (key) {
      payload[key] = fields[key];
    });
  }

  emit('error', event, payload);
}

function incrementCounter(name, fields) {
  counters[name] = (counters[name] || 0) + 1;
  emit('info', 'metric.counter', Object.assign({ metric: name, value: counters[name] }, fields || {}));
  return counters[name];
}

function getCounter(name) {
  return counters[name] || 0;
}

module.exports = {
  auditEvent: auditEvent,
  trackError: trackError,
  incrementCounter: incrementCounter,
  getCounter: getCounter
};
