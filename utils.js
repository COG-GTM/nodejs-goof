var crypto = require('crypto');

var SCRYPT_N = 16384;
var SCRYPT_r = 8;
var SCRYPT_p = 1;
var KEY_LEN = 64;

module.exports = {

  // Generates a cryptographically random password, url-safe.
  random_password : function ( bytes ){
    return crypto.randomBytes( bytes || 24 ).toString( 'base64url' );
  },

  // Returns "scrypt$N$r$p$saltHex$hashHex".
  hash_password : function ( password ){
    if ( typeof password !== 'string' || password.length === 0 ) {
      throw new TypeError( 'password must be a non-empty string' );
    }

    var salt = crypto.randomBytes( 16 );
    var hash = crypto.scryptSync( password, salt, KEY_LEN, {
      N : SCRYPT_N, r : SCRYPT_r, p : SCRYPT_p,
    });

    return [ 'scrypt', SCRYPT_N, SCRYPT_r, SCRYPT_p,
      salt.toString( 'hex' ), hash.toString( 'hex' ) ].join( '$' );
  },

  verify_password : function ( password, stored ){
    if ( typeof password !== 'string' || typeof stored !== 'string' ) {
      return false;
    }

    var parts = stored.split( '$' );
    if ( parts.length !== 6 || parts[ 0 ] !== 'scrypt' ) {
      return false;
    }

    var N = parseInt( parts[ 1 ], 10 );
    var r = parseInt( parts[ 2 ], 10 );
    var p = parseInt( parts[ 3 ], 10 );
    var salt = Buffer.from( parts[ 4 ], 'hex' );
    var expected = Buffer.from( parts[ 5 ], 'hex' );

    if ( !N || !r || !p || salt.length === 0 || expected.length === 0 ) {
      return false;
    }

    var actual;
    try {
      actual = crypto.scryptSync( password, salt, expected.length, { N : N, r : r, p : p });
    } catch ( err ) {
      return false;
    }

    return crypto.timingSafeEqual( actual, expected );
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
