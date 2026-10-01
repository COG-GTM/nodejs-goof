// TypeORM logger that never writes SQL parameters, result rows or driver
// error messages (which can echo column values) to the log.

function errorCode(err) {
  if (!err) return 'unknown'
  if (typeof err === 'string') return 'error'
  return err.code || err.name || 'error'
}

function QueryLogger(out) {
  this.out = out || console
}

QueryLogger.prototype.logQuery = function () {}

QueryLogger.prototype.logQueryError = function (err, query, parameters) {
  this.out.error('typeorm query failed', {
    code: errorCode(err),
    query: query,
    parameterCount: parameters ? parameters.length : 0
  })
}

QueryLogger.prototype.logQuerySlow = function (time, query, parameters) {
  this.out.warn('typeorm query is slow', {
    timeMs: time,
    query: query,
    parameterCount: parameters ? parameters.length : 0
  })
}

QueryLogger.prototype.logSchemaBuild = function () {}

QueryLogger.prototype.logMigration = function (message) {
  this.out.info('typeorm migration', message)
}

QueryLogger.prototype.log = function (level, message) {
  if (level === 'warn') this.out.warn('typeorm', message)
}

QueryLogger.errorCode = errorCode
module.exports = QueryLogger
