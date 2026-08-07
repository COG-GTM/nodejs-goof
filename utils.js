var crypto = require( 'crypto' );

var SCRYPT_COST    = 16384;
var SCRYPT_BLOCK   = 8;
var SCRYPT_PARALLEL = 1;
var SCRYPT_KEYLEN  = 32;
var SALT_BYTES     = 16;

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

  random_password : function ( bytes ){
    return crypto.randomBytes( bytes || 24 ).toString( 'base64' )
      .replace( /\+/g, '-' ).replace( /\//g, '_' ).replace( /=+$/, '' );
  },

  hash_password : function ( password ){
    var salt = crypto.randomBytes( SALT_BYTES );
    var hash = crypto.scryptSync( String( password ), salt, SCRYPT_KEYLEN, {
      N : SCRYPT_COST, r : SCRYPT_BLOCK, p : SCRYPT_PARALLEL
    });

    return [ 'scrypt', SCRYPT_COST, SCRYPT_BLOCK, SCRYPT_PARALLEL,
      salt.toString( 'hex' ), hash.toString( 'hex' ) ].join( '$' );
  },

  verify_password : function ( password, stored ){
    if( typeof password !== 'string' || typeof stored !== 'string' ){
      return false;
    }

    var parts = stored.split( '$' );
    if( parts.length !== 6 || parts[ 0 ] !== 'scrypt' ){
      return false;
    }

    var cost     = parseInt( parts[ 1 ], 10 );
    var block    = parseInt( parts[ 2 ], 10 );
    var parallel = parseInt( parts[ 3 ], 10 );
    if( !cost || !block || !parallel ){
      return false;
    }

    var salt, expected;
    try {
      salt     = Buffer.from( parts[ 4 ], 'hex' );
      expected = Buffer.from( parts[ 5 ], 'hex' );
    } catch( err ){
      return false;
    }

    if( salt.length === 0 || expected.length === 0 ){
      return false;
    }

    var actual;
    try {
      actual = crypto.scryptSync( password, salt, expected.length, {
        N : cost, r : block, p : parallel
      });
    } catch( err ){
      return false;
    }

    return crypto.timingSafeEqual( actual, expected );
  },

  forbidden : function ( res ){
    var body       = 'Forbidden';
    res.statusCode = 403;

    res.setHeader( 'Content-Type', 'text/plain' );
    res.setHeader( 'Content-Length', body.length );
    res.end( body );
  }
};
