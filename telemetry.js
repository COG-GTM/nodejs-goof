'use strict';

// Minimal dependency-free telemetry helper: structured JSON events on stdout
// (stderr for failures) plus in-process counters that can be scraped by a
// sidecar or dumped on shutdown.

var counters = Object.create(null);

function counterKey(name, outcome) {
  return outcome ? name + '{outcome="' + outcome + '"}' : name;
}

function increment(name, outcome, delta) {
  var key = counterKey(name, outcome);
  counters[key] = (counters[key] || 0) + (typeof delta === 'number' ? delta : 1);
  return counters[key];
}

function serializeError(err) {
  if (!err) return undefined;
  return {
    name: err.name,
    message: err.message,
    code: err.code,
  };
}

function emit(event, fields) {
  var payload = Object.assign(
    {
      timestamp: new Date().toISOString(),
      event: event,
    },
    fields || {}
  );

  if (payload.error) {
    payload.error = serializeError(payload.error);
  }

  var line = JSON.stringify(payload);
  if (payload.outcome === 'failure') {
    console.error(line);
  } else {
    console.log(line);
  }
  return payload;
}

// Records the outcome of a single operation: one structured event and one
// counter sample keyed by success/failure.
function record(event, outcome, fields) {
  increment(event, outcome);
  return emit(event, Object.assign({ outcome: outcome }, fields || {}));
}

function success(event, fields) {
  return record(event, 'success', fields);
}

function failure(event, err, fields) {
  return record(event, 'failure', Object.assign({ error: err }, fields || {}));
}

function snapshot() {
  return Object.assign({}, counters);
}

module.exports = {
  emit: emit,
  record: record,
  success: success,
  failure: failure,
  increment: increment,
  snapshot: snapshot,
};
