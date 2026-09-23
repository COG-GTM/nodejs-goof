var optional = require('optional');

var Sentry = optional('@sentry/node');

function emit(level, event, fields) {
  var record = Object.assign({
    level: level,
    event: event,
    component: 'startup',
    timestamp: new Date().toISOString()
  }, fields || {});

  var line = JSON.stringify(record);
  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

function reportStartupSuccess(event, fields) {
  emit('info', event, fields);
}

function reportStartupFailure(event, err, fields) {
  emit('error', event, Object.assign({
    error_message: err && err.message ? err.message : String(err),
    error_name: err && err.name ? err.name : undefined,
    stack: err && err.stack ? err.stack : undefined
  }, fields || {}));

  if (Sentry && typeof Sentry.captureException === 'function') {
    Sentry.captureException(err, { tags: Object.assign({ startup_event: event }, fields || {}) });
  }
}

module.exports = {
  reportStartupSuccess: reportStartupSuccess,
  reportStartupFailure: reportStartupFailure
};
