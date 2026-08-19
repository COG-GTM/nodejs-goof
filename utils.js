var crypto = require('crypto');

var MIN_SESSION_SECRET_LENGTH = 32;

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

  session_secret : function ( env ){
    env = env || process.env;
    var secret = env.SESSION_SECRET;

    if( secret && secret.length >= MIN_SESSION_SECRET_LENGTH ){
      return secret;
    }

    if( env.NODE_ENV === 'production' ){
      throw new Error( 'SESSION_SECRET must be set to at least ' +
        MIN_SESSION_SECRET_LENGTH + ' characters in production' );
    }

    console.warn( 'SESSION_SECRET is unset or too short; generating an ' +
      'ephemeral session secret. Sessions will not survive a restart.' );

    return crypto.randomBytes( 32 ).toString( 'hex' );
  },

  session_cookie : function ( env ){
    env = env || process.env;

    var secure = env.NODE_ENV === 'production';
    if( env.SESSION_COOKIE_SECURE === 'true' ){
      secure = true;
    } else if( env.SESSION_COOKIE_SECURE === 'false' ){
      secure = false;
    }

    return {
      path     : '/',
      httpOnly : true,
      sameSite : 'lax',
      secure   : secure
    };
  }
};
