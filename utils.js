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

  // Allow-list a user supplied redirect target: only same-site, relative
  // paths made of unreserved URL characters. Anything else yields ''.
  safe_redirect_path : function ( value ){
    if( typeof value !== 'string' ) return '';
    if( !/^\/[A-Za-z0-9\-._~%/?&=+:@,;!$'()*]*$/.test( value )) return '';
    if( value.startsWith( '//' )) return '';
    if( value.split( '/' ).indexOf( '..' ) !== -1 ) return '';

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
