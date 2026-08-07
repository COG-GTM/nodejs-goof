var marked = require('marked');

var ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:'];
var HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

function escapeHtml (value) {
  return String(value).replace(/[&<>"']/g, function (char) {
    return HTML_ENTITIES[char];
  });
}

function decodeEntities (value) {
  return value
    .replace(/&#[xX]([0-9a-fA-F]+);?/g, function (match, hex) {
      return String.fromCharCode(parseInt(hex, 16));
    })
    .replace(/&#(\d+);?/g, function (match, dec) {
      return String.fromCharCode(parseInt(dec, 10));
    })
    .replace(/&quot;?/gi, '"')
    .replace(/&apos;?/gi, "'")
    .replace(/&lt;?/gi, '<')
    .replace(/&gt;?/gi, '>')
    .replace(/&amp;?/gi, '&');
}

// Returns the url when it is safe to emit in an href/src attribute, null otherwise.
// The url is normalised the way a browser would (entity decoding, percent decoding,
// control character stripping) before its protocol is checked against the allowlist.
function safeUrl (url) {
  if (!url) return null;

  var normalised = String(url);
  for (var i = 0; i < 3; i++) {
    var decoded = decodeEntities(normalised);
    try {
      decoded = decodeURIComponent(decoded);
    } catch (err) {
      // keep the entity-decoded form when the url is not valid percent encoding
    }
    if (decoded === normalised) break;
    normalised = decoded;
  }
  normalised = normalised.replace(/[\u0000-\u0020\u007f-\u00a0]/g, '');

  // anything up to the first path separator that ends in a colon is treated as
  // a protocol, however unusual its characters are
  var protocol = /^([^\/?#]*):/.exec(normalised);
  if (protocol && ALLOWED_PROTOCOLS.indexOf(protocol[1].toLowerCase() + ':') === -1) {
    return null;
  }

  return url;
}

var renderer = new marked.Renderer();

renderer.link = function (href, title, text) {
  var url = safeUrl(href);
  if (!url) return text;

  var out = '<a href="' + escapeHtml(url) + '"';
  if (title) out += ' title="' + escapeHtml(title) + '"';
  return out + ' rel="nofollow noopener noreferrer">' + text + '</a>';
};

renderer.image = function (href, title, text) {
  var url = safeUrl(href);
  if (!url) return escapeHtml(text || '');

  var out = '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(text || '') + '"';
  if (title) out += ' title="' + escapeHtml(title) + '"';
  return out + '>';
};

renderer.html = function (html) {
  return escapeHtml(html);
};

/**
 * Renders user supplied markdown as HTML that is safe to emit unescaped.
 *
 * The markdown source is HTML escaped first, so no attacker controlled tag or
 * attribute can survive into the output: every tag in the result is generated
 * by the renderer, and the only attacker controlled attribute values (href,
 * src, title, alt) are protocol checked and escaped here. This does not rely
 * on marked's own `sanitize` option, which is deprecated and bypassable.
 */
function renderMarkdown (content) {
  if (content === null || content === undefined) return '';

  return marked(escapeHtml(content), {
    renderer: renderer,
    sanitize: true,
    headerIds: false,
    mangle: false
  });
}

module.exports = renderMarkdown;
module.exports.escapeHtml = escapeHtml;
module.exports.safeUrl = safeUrl;
