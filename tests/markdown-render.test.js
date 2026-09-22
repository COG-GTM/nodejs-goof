var tap   = require( 'tap' );
var utils = require( '../utils' );

tap.test( 'renders plain markdown', function ( t ){
  t.match( utils.render_markdown( '**bold**' ), /<strong>bold<\/strong>/ );
  t.end();
});

var SAFE_TAGS = [
  'p', 'a', 'img', 'em', 'strong', 'code', 'pre', 'blockquote', 'ul', 'ol',
  'li', 'hr', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'del', 'table',
  'thead', 'tbody', 'tr', 'th', 'td'
];

function tags_in ( html ){
  var found = [];
  html.replace( /<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, function ( tag, name, attrs ){
    found.push({ name : name.toLowerCase(), attrs : attrs });
    return tag;
  });
  return found;
}

tap.test( 'does not emit attacker supplied html', function ( t ){
  var payloads = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<<script>script>alert(1)<</script>/script>',
    '<a href="javascript:alert(1)">click</a>',
    '<div onclick="alert(1)">x</div>',
    '<iframe src="javascript:alert(1)"></iframe>',
    '<svg/onload=alert(1)>'
  ];

  payloads.forEach( function ( payload ){
    var html = utils.render_markdown( payload );

    tags_in( html ).forEach( function ( tag ){
      t.ok( SAFE_TAGS.indexOf( tag.name ) !== -1, payload + ' -> <' + tag.name + '>' );
      t.notMatch( tag.attrs, /on[a-z]+\s*=/i, payload );
      t.notMatch( tag.attrs, /javascript:/i, payload );
    });
  });

  t.end();
});

tap.test( 'drops unsafe link and image targets', function ( t ){
  t.notMatch( utils.render_markdown( '[click](javascript:alert(1))' ), /javascript:/i );
  t.notMatch( utils.render_markdown( '[click](java\tscript:alert(1))' ), /javascript:/i );
  t.notMatch( utils.render_markdown( '![x](data:text/html;base64,PHNjcmlwdD4=)' ), /data:/i );
  t.match( utils.render_markdown( '[click](https://example.com)' ), /href="https:\/\/example\.com"/ );
  t.match( utils.render_markdown( '[click](/edit/1)' ), /href="\/edit\/1"/ );
  t.end();
});

tap.test( 'handles non string content', function ( t ){
  t.equal( utils.render_markdown( null ), '' );
  t.equal( utils.render_markdown( undefined ), '' );
  t.match( utils.render_markdown( 42 ), /42/ );
  t.end();
});
