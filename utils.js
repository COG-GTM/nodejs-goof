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

  // Returns the value only when it is a safe same-origin relative path,
  // otherwise an empty string.
  safe_redirect_path : function ( value ){
    if( typeof value !== 'string' ) return '';
    if( value === '/' ) return value;
    if( !/^\/[^/\\]/.test( value )) return '';
    if( /[\s\x00-\x1f\x7f]/.test( value )) return '';

    return value;
  },

  forbidden : function ( res ){
    var body       = 'Forbidden';
    res.statusCode = 403;

    res.setHeader( 'Content-Type', 'text/plain' );
    res.setHeader( 'Content-Length', body.length );
    res.end( body );
  }
};
