var fs = require('fs');
var path = require('path');

// moment.locales() only lists locales already loaded, so build the allow-list
// from the locale files bundled with moment.
var MOMENT_LOCALES = (function () {
  var names = ['en'];
  try {
    var dir = path.join(path.dirname(require.resolve('moment')), 'locale');
    fs.readdirSync(dir).forEach(function (file) {
      if (/^[a-z0-9-]+\.js$/i.test(file)) {
        names.push(file.slice(0, -3).toLowerCase());
      }
    });
  } catch (e) {
    // fall back to the built-in English locale only
  }
  return names;
})();

module.exports = {

  safeMomentLocale : function ( name ){
    if ( typeof name !== 'string' ) return null;
    var normalized = name.trim().toLowerCase().replace( /_/g, '-' );
    return MOMENT_LOCALES.indexOf( normalized ) !== -1 ? normalized : null;
  },

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
  }
};
