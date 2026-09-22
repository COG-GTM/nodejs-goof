var marked = require( 'marked' );

var HTML_ESCAPES = {
  '&' : '&amp;',
  '<' : '&lt;',
  '>' : '&gt;',
  '"' : '&quot;',
  "'" : '&#39;',
  '`' : '&#96;'
};

function escape_html ( str ){
  return String( str ).replace( /[&<>"'`]/g, function ( chr ){
    return HTML_ESCAPES[ chr ];
  });
}

// Only absolute http(s)/mailto URLs and relative references may reach an
// href/src attribute; everything else (javascript:, data:, vbscript:, ...)
// is dropped.
function safe_url ( url ){
  if( typeof url !== 'string' ) return null;

  var trimmed = url.replace( /[\u0000-\u0020\u007f]/g, '' );

  if( /^[a-z][a-z0-9+.\-]*:/i.test( trimmed )){
    if( !/^(https?|mailto):/i.test( trimmed )) return null;
  }

  return trimmed;
}

var safe_renderer = new marked.Renderer();

safe_renderer.link = function ( href, title, text ){
  var url = safe_url( href );

  if( url === null ) return text;

  return '<a href="' + escape_html( url ) + '"'
    + ( title ? ' title="' + escape_html( title ) + '"' : '' )
    + ' rel="nofollow noopener noreferrer">' + text + '</a>';
};

safe_renderer.image = function ( href, title, text ){
  var url = safe_url( href );

  if( url === null ) return escape_html( text || '' );

  return '<img src="' + escape_html( url ) + '" alt="' + escape_html( text || '' ) + '"'
    + ( title ? ' title="' + escape_html( title ) + '"' : '' ) + ' />';
};

safe_renderer.html = function (){
  return '';
};

module.exports = {

  escape_html : escape_html,

  safe_url : safe_url,

  // Renders user supplied markdown. The input is HTML escaped before it
  // reaches marked, so no attacker controlled markup can survive into the
  // rendered output; link and image targets are additionally restricted to
  // safe URL schemes.
  render_markdown : function ( content ){
    if( content === undefined || content === null ) return '';

    return marked( escape_html( content ), {
      renderer : safe_renderer,
      sanitize : true,
      sanitizer : escape_html
    });
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
