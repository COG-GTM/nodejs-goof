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
    var root = path.resolve( targetDir );

    function zipError( code, message ){
      var err  = new Error( message );
      err.code = code;
      return err;
    }

    // adm-zip >= 0.5 reads the central directory lazily, so a corrupt archive throws here
    var entries;
    try {
      entries = zip.getEntries();
    } catch( e ){
      throw zipError( 'ZIP_INVALID_ARCHIVE', 'Corrupt zip archive' );
    }

    entries.forEach( function ( entry ){
      var dest = path.resolve( root, entry.entryName );
      // a "./" directory entry resolves to root itself; only directories may do that
      var isRootDir = dest === root && entry.isDirectory;
      if( !isRootDir && dest.indexOf( root + path.sep ) !== 0 ){
        throw zipError( 'ZIP_ENTRY_OUTSIDE_TARGET', 'Illegal zip entry path: ' + entry.entryName );
      }
    });

    // extract into a sibling staging dir and publish only once every entry decoded,
    // so a corrupt archive never overwrites existing output
    fs.mkdirSync( path.dirname( root ), { recursive : true });
    var staging = fs.mkdtempSync( root + '-staging-' );
    // keyed by normalized path so duplicate entries publish once (last one wins)
    var written = Object.create( null );

    try {
      entries.forEach( function ( entry ){
        var rel = path.relative( root, path.resolve( root, entry.entryName ));
        var tmp = path.join( staging, rel );
        if( entry.isDirectory ){
          fs.mkdirSync( tmp, { recursive : true });
          written[ rel ] = written[ rel ] || { rel : rel, isDirectory : true };
          return;
        }

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
        fs.mkdirSync( path.dirname( tmp ), { recursive : true });
        fs.writeFileSync( tmp, data );
        written[ rel ] = { rel : rel, isDirectory : false };
      });

      Object.keys( written ).forEach( function ( key ){
        var item = written[ key ];
        var dest = path.join( root, item.rel );
        if( item.isDirectory ){
          fs.mkdirSync( dest, { recursive : true });
          return;
        }
        fs.mkdirSync( path.dirname( dest ), { recursive : true });
        fs.renameSync( path.join( staging, item.rel ), dest );
      });
    } finally {
      fs.rmSync( staging, { recursive : true, force : true });
    }
  }
};
