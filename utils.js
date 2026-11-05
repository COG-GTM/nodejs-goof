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

    function zipError( code, message ){
      var err  = new Error( message );
      err.code = code;
      return err;
    }

    var files = entries.map( function ( entry ){
      var dest = path.resolve( root, entry.entryName );
      if( dest.indexOf( root + path.sep ) !== 0 ){
        throw zipError( 'ZIP_ENTRY_OUTSIDE_TARGET', 'Illegal zip entry path: ' + entry.entryName );
      }
      if( entry.isDirectory ) return { dest : dest };

      var data;
      try {
        data = entry.getData();
      } catch( e ){
        data = null;
      }
      // adm-zip returns an error string instead of a Buffer on bad CRC / unknown method
      if( !Buffer.isBuffer( data )){
        throw zipError( 'ZIP_INVALID_ARCHIVE', 'Corrupt zip entry: ' + entry.entryName );
      }
      return { dest : dest, data : data };
    });

    files.forEach( function ( file ){
      if( !file.data ){
        fs.mkdirSync( file.dest, { recursive : true });
        return;
      }
      fs.mkdirSync( path.dirname( file.dest ), { recursive : true });
      fs.writeFileSync( file.dest, file.data );
    });
  }
};
