var fs   = require( 'fs' );
var path = require( 'path' );

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

  // Resolves a zip entry name inside root, or null when the entry escapes it
  // (Zip Slip: '../' segments, absolute paths, drive-relative names).
  safe_extract_path : function ( root, entry_name ){
    if ( typeof entry_name !== 'string' || entry_name === '' ){
      return null;
    }

    var resolved_root = path.resolve( root );
    var target        = path.resolve( resolved_root, entry_name.replace( /\\/g, '/' ));

    if ( target !== resolved_root && target.indexOf( resolved_root + path.sep ) !== 0 ){
      return null;
    }

    return target;
  },

  // Extracts every entry of an AdmZip instance below dest, skipping entries
  // whose name would write outside of it. Returns the written paths.
  safe_extract_zip : function ( zip, dest ){
    var self      = this;
    var extracted = [];

    zip.getEntries().forEach( function ( entry ){
      var target = self.safe_extract_path( dest, entry.entryName );

      if ( target === null ){
        console.error( 'skipping unsafe zip entry: ' + entry.entryName );
        return;
      }

      if ( entry.isDirectory ){
        fs.mkdirSync( target, { recursive : true });
        return;
      }

      fs.mkdirSync( path.dirname( target ), { recursive : true });
      fs.writeFileSync( target, entry.getData());
      extracted.push( target );
    });

    return extracted;
  },

  forbidden : function ( res ){
    var body       = 'Forbidden';
    res.statusCode = 403;

    res.setHeader( 'Content-Type', 'text/plain' );
    res.setHeader( 'Content-Length', body.length );
    res.end( body );
  }
};
