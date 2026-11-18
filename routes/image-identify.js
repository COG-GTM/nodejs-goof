var childProcess = require('child_process');

var ALLOWED_PROTOCOLS = ['http:', 'https:'];

function allowedHosts() {
  return (process.env.IMAGE_HOST_ALLOWLIST || '')
    .split(',')
    .map(function (h) { return h.trim().toLowerCase(); })
    .filter(Boolean);
}

function parseImageUrl(raw, hosts) {
  if (typeof raw !== 'string') return null;
  var url;
  try {
    url = new URL(raw);
  } catch (e) {
    return null;
  }
  if (ALLOWED_PROTOCOLS.indexOf(url.protocol) === -1) return null;
  if (url.username || url.password) return null;
  if ((hosts || allowedHosts()).indexOf(url.hostname.toLowerCase()) === -1) return null;
  return url.href;
}

function identifyImage(raw, opts) {
  opts = opts || {};
  var execFile = opts.execFile || childProcess.execFile;
  var url = parseImageUrl(raw, opts.hosts);
  if (!url) {
    console.log('skipping identify for disallowed image url');
    return false;
  }
  execFile('identify', [url], { timeout: 10000 }, function (err, stdout, stderr) {
    if (err) {
      console.log('Error (' + err + '):' + stderr);
    }
  });
  return true;
}

module.exports = {
  parseImageUrl: parseImageUrl,
  identifyImage: identifyImage,
};
