var fs = require('fs');
var path = require('path');

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

    entries.forEach( function ( entry ){
      var dest = path.resolve( root, entry.entryName );
      if( dest.indexOf( root + path.sep ) !== 0 ){
        throw new Error( 'Illegal zip entry path: ' + entry.entryName );
      }
    });

    entries.forEach( function ( entry ){
      var dest = path.resolve( root, entry.entryName );
      if( entry.isDirectory ){
        fs.mkdirSync( dest, { recursive : true });
        return;
      }
      fs.mkdirSync( path.dirname( dest ), { recursive : true });
      fs.writeFileSync( dest, entry.getData());
    });
  }
};
