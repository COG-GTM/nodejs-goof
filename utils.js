var crypto = require('crypto');

module.exports = {

  session_secret : function ( env ){
    env = env || process.env;
    var secret = env.SESSION_SECRET;

    if( typeof secret === 'string' && secret.length >= 32 ){
      return secret;
    }

    if( typeof secret === 'string' && secret.length > 0 ){
      throw new Error( 'SESSION_SECRET must be at least 32 characters long' );
    }

    if( env.NODE_ENV === 'production' ){
      throw new Error( 'SESSION_SECRET must be set in production' );
    }

    console.warn( 'SESSION_SECRET is not set, generating an ephemeral session secret' );
    return crypto.randomBytes( 32 ).toString( 'hex' );
  },

  session_cookie : function ( env ){
    env = env || process.env;

    return {
      path     : '/',
      httpOnly : true,
      sameSite : 'lax',
      secure   : env.SESSION_COOKIE_SECURE
        ? env.SESSION_COOKIE_SECURE !== 'false'
        : env.NODE_ENV === 'production'
    };
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
