'use strict';

const counters = Object.create(null);

function counterKey(name, labels) {
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}="${labels[k]}"`);
  return parts.length ? `${name}{${parts.join(',')}}` : name;
}

function increment(name, labels = {}) {
  const key = counterKey(name, labels);
  counters[key] = (counters[key] || 0) + 1;
  return counters[key];
}

function getCounters() {
  return Object.assign({}, counters);
}

function logEvent(event, fields = {}) {
  console.log(JSON.stringify(Object.assign({
    event,
    timestamp: new Date().toISOString(),
  }, fields)));
}

module.exports = { increment, getCounters, logEvent };
