var crypto = require( 'crypto' );

var SCRYPT_KEYLEN = 64;
var SCRYPT_PARAMS = { N : 16384, r : 8, p : 1 };

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
    return crypto.randomBytes( bytes || 18 ).toString( 'base64' )
      .replace( /\+/g, '-' ).replace( /\//g, '_' ).replace( /=+$/, '' );
  },

  hash_password : function ( password ){
    var salt    = crypto.randomBytes( 16 );
    var derived = crypto.scryptSync( password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS );

    return [
      'scrypt', SCRYPT_PARAMS.N, SCRYPT_PARAMS.r, SCRYPT_PARAMS.p,
      salt.toString( 'hex' ), derived.toString( 'hex' )
    ].join( '$' );
  },

  verify_password : function ( password, stored ){
    if( typeof password !== 'string' || typeof stored !== 'string' ){
      return false;
    }

    var parts = stored.split( '$' );
    if( parts.length !== 6 || parts[ 0 ] !== 'scrypt' ){
      return false;
    }

    var params   = { N : parseInt( parts[ 1 ], 10 ), r : parseInt( parts[ 2 ], 10 ), p : parseInt( parts[ 3 ], 10 )};
    var salt     = Buffer.from( parts[ 4 ], 'hex' );
    var expected = Buffer.from( parts[ 5 ], 'hex' );
    var derived;

    try {
      derived = crypto.scryptSync( password, salt, expected.length, params );
    } catch( e ){
      return false;
    }

    return derived.length === expected.length && crypto.timingSafeEqual( derived, expected );
  },

  forbidden : function ( res ){
    var body       = 'Forbidden';
    res.statusCode = 403;

    res.setHeader( 'Content-Type', 'text/plain' );
    res.setHeader( 'Content-Length', body.length );
    res.end( body );
  }
};
