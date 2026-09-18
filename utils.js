var hms = require('humanize-ms');
var ms = require('ms');

module.exports = {

  // Turns a '<todo> in <duration>' string into '<todo> [<humanized duration>]'.
  parse : function ( todo ){
    var t = todo;

    var remindToken = ' in ';
    var reminder = t.toString().indexOf( remindToken );
    if( reminder > 0 ){
      var time = t.slice( reminder + remindToken.length );
      time = time.replace( /\n$/, '' );

      var period = hms( time );

      // remove it
      t = t.slice( 0, reminder );
      if( typeof period != 'undefined' ){
        t += ' [' + ms( period ) + ']';
      }
    }
    return t;
  },

  isBlank : function ( str ){
    return (!str || /^\s*$/.test( str ));
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
