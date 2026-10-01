var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var GENESIS_HASH = new Array(65).join('0');
var MAX_FIELD_LENGTH = 256;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hashRecord(prevHash, record) {
  return sha256(prevHash + '\n' + JSON.stringify(record));
}

function truncate(value) {
  if (value === undefined || value === null) return null;
  value = String(value);
  return value.length > MAX_FIELD_LENGTH ? value.slice(0, MAX_FIELD_LENGTH) : value;
}

function readLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8').split('\n').filter(function (line) {
    return line.length > 0;
  });
}

function AuditLog(options) {
  options = options || {};
  this.filePath = options.filePath ||
    process.env.AUDIT_LOG_PATH ||
    path.join(__dirname, '..', 'logs', 'audit.log');
  this.hmacKey = options.hmacKey || process.env.AUDIT_LOG_HMAC_KEY;
  if (!this.hmacKey) {
    this.hmacKey = crypto.randomBytes(32).toString('hex');
    console.warn('AUDIT_LOG_HMAC_KEY is not set; audit actor_ref values will not correlate across restarts');
  }
  this.seq = null;
  this.prevHash = null;
}

AuditLog.prototype._loadChainHead = function () {
  if (this.prevHash !== null) return;
  fs.mkdirSync(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
  var lines = readLines(this.filePath);
  if (lines.length === 0) {
    this.seq = 0;
    this.prevHash = GENESIS_HASH;
    return;
  }
  var last = JSON.parse(lines[lines.length - 1]);
  this.seq = last.seq;
  this.prevHash = last.hash;
};

AuditLog.prototype.actorRef = function (identifier) {
  if (identifier === undefined || identifier === null) return null;
  return crypto.createHmac('sha256', this.hmacKey)
    .update(String(identifier).trim().toLowerCase())
    .digest('hex')
    .slice(0, 32);
};

AuditLog.prototype.record = function (event) {
  this._loadChainHead();
  var record = {
    seq: this.seq + 1,
    ts: new Date().toISOString(),
    event: event.event,
    outcome: event.outcome,
    reason: event.reason || null,
    actor_id: event.actorId ? String(event.actorId) : null,
    actor_ref: this.actorRef(event.actorIdentifier),
    source_ip: truncate(event.sourceIp),
    user_agent: truncate(event.userAgent),
    prev_hash: this.prevHash
  };
  record.hash = hashRecord(this.prevHash, record);
  fs.appendFileSync(this.filePath, JSON.stringify(record) + '\n', { mode: 0o600 });
  this.seq = record.seq;
  this.prevHash = record.hash;
  return record;
};

AuditLog.prototype.recordLogin = function (req, outcome, details) {
  details = details || {};
  var connection = req.connection || {};
  var headers = req.headers || {};
  return this.record({
    event: 'auth.login',
    outcome: outcome,
    reason: details.reason,
    actorId: details.userId,
    actorIdentifier: details.username,
    sourceIp: req.ip || connection.remoteAddress,
    userAgent: headers['user-agent']
  });
};

function verify(filePath) {
  var prevHash = GENESIS_HASH;
  var lines = readLines(filePath);
  for (var i = 0; i < lines.length; i++) {
    var record = JSON.parse(lines[i]);
    var hash = record.hash;
    delete record.hash;
    if (record.seq !== i + 1 || record.prev_hash !== prevHash || hashRecord(prevHash, record) !== hash) {
      return { valid: false, records: lines.length, brokenAt: i + 1 };
    }
    prevHash = hash;
  }
  return { valid: true, records: lines.length };
}

var defaultLog = null;

function getDefault() {
  if (!defaultLog) defaultLog = new AuditLog();
  return defaultLog;
}

module.exports = {
  AuditLog: AuditLog,
  verify: verify,
  recordLogin: function (req, outcome, details) {
    return getDefault().recordLogin(req, outcome, details);
  }
};

if (require.main === module && process.argv[2] === 'verify') {
  var target = process.argv[3] || process.env.AUDIT_LOG_PATH || path.join(__dirname, '..', 'logs', 'audit.log');
  var result = verify(target);
  console.log(JSON.stringify(result));
  process.exit(result.valid ? 0 : 1);
}
