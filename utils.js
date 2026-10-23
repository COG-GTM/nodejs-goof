var fs = require('fs');
var path = require('path');

function isUnsafeZipEntryName(name, root) {
  if (typeof name !== 'string' || name.length === 0) return true;
  if (name.indexOf('\0') !== -1) return true;
  if (path.isAbsolute(name) || /^[\\/]/.test(name) || /^[a-zA-Z]:/.test(name)) return true;
  if (name.split(/[\\/]+/).indexOf('..') !== -1) return true;
  var dest = path.resolve(root, name);
  return dest !== root && dest.indexOf(root + path.sep) !== 0;
}

function isSymlink(p) {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

function hasSymlinkBelowRoot(root, name) {
  var current = root;
  var parts = name.split(/[\\/]+/).filter(Boolean);
  for (var i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    if (isSymlink(current)) return true;
  }
  return false;
}

module.exports = {

  ran_no : function ( min, max ){
    return Math.floor( Math.random() * ( max - min + 1 )) + min;
  },

  uid : function ( len ){
    var str     = '';
    var src     = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var src_len = src.length;
    var i       = len;

    for( ; i-- ; ){
      str += src.charAt( this.ran_no( 0, src_len - 1 ));
    }

    return str;
  },

  forbidden : function ( res ){
    var body       = 'Forbidden';
    res.statusCode = 403;

    res.setHeader( 'Content-Type', 'text/plain' );
    res.setHeader( 'Content-Length', body.length );
    res.end( body );
  },

  safeExtractZip : function ( zip, targetDir ){
    var root    = path.resolve( targetDir );
    var entries = zip.getEntries();

    if( isSymlink( root )){
      throw new Error( 'Extraction directory is a symlink: ' + root );
    }

    entries.forEach( function ( entry ){
      if( isUnsafeZipEntryName( entry.entryName, root ) ||
          hasSymlinkBelowRoot( root, entry.entryName )){
        throw new Error( 'Unsafe zip entry path: ' + entry.entryName );
      }
    });

    zip.extractAllTo( root, true );
  }
};
