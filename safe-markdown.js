/**
 * Markdown rendering for user supplied content.
 *
 * The markdown source is HTML escaped before it reaches marked, so the only
 * markup in the result is markup marked itself generated. URLs of the links
 * and images marked generates are resolved the way a browser resolves them
 * (HTML entities and percent encoding decoded, insignificant characters
 * dropped) and are only kept when they carry an allowed scheme.
 */

var marked = require('marked');

var LINK_SCHEMES = ['http', 'https', 'mailto'];
var IMAGE_SCHEMES = ['http', 'https'];

var NAMED_ENTITIES = {
  amp: '&',
  apos: '\'',
  colon: ':',
  gt: '>',
  lt: '<',
  newline: '\n',
  nbsp: '\u00a0',
  quot: '"',
  sol: '/',
  tab: '\t',
};

// Escapes the markdown source so that marked cannot be talked into emitting
// markup that did not come from markdown syntax. Quotes are left alone, they
// delimit link titles and are escaped again on the way out.
function escapeMarkdownSource(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Escapes text that may already be escaped, without escaping it twice.
function escapeHtmlOnce(text) {
  return String(text)
    .replace(/&(?!#?\w+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Browsers ignore control characters and whitespace while resolving a URL.
function stripInsignificant(url) {
  return url.replace(/[\u0000-\u0020\u007f-\u00a0]/g, '');
}

// Browsers accept entities without the trailing semicolon, so it is optional
// here as well: '&#58this' decodes to ':this', like in a real href.
function decodeEntities(url) {
  return url.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);?/g, function (entity, body) {
    if (body.charAt(0) !== '#') {
      var named = NAMED_ENTITIES[body.toLowerCase()];
      return named === undefined ? entity : named;
    }

    var hex = body.charAt(1) === 'x' || body.charAt(1) === 'X';
    var code = parseInt(hex ? body.substring(2) : body.substring(1), hex ? 16 : 10);
    if (isNaN(code) || code < 0 || code > 0x10ffff) return '';
    return String.fromCharCode(code);
  });
}

function resolveUrl(url) {
  var resolved = stripInsignificant(String(url));

  for (var i = 0; i < 5; i++) {
    var next = decodeEntities(resolved);
    try {
      next = decodeURIComponent(next);
    } catch (e) {
      // Leave malformed percent encoding as it is.
    }
    next = stripInsignificant(next);
    if (next === resolved) break;
    resolved = next;
  }

  return resolved;
}

function schemeOf(url) {
  var scheme = url.match(/^([a-zA-Z][a-zA-Z0-9+.\-]*):/);
  return scheme ? scheme[1].toLowerCase() : null;
}

// A URL is allowed when neither the literal nor the browser resolved form
// carries a scheme outside of the allow list. Relative URLs have no scheme
// and are always allowed.
function isAllowedUrl(url, allowedSchemes) {
  var forms = [stripInsignificant(String(url)), resolveUrl(url)];

  for (var i = 0; i < forms.length; i++) {
    var scheme = schemeOf(forms[i]);
    if (scheme !== null && allowedSchemes.indexOf(scheme) === -1) return false;
  }

  return true;
}

// Neutralises characters that could break out of the attribute. '&' is left
// alone because the value reaching the renderer is escaped already.
function escapeUrlAttribute(url) {
  return String(url).replace(/["'`<>\s]/g, encodeURIComponent);
}

var renderer = new marked.Renderer();

renderer.link = function (href, title, text) {
  if (!isAllowedUrl(href, LINK_SCHEMES)) return text;

  var out = '<a href="' + escapeUrlAttribute(href) + '"';
  if (title) out += ' title="' + escapeHtmlOnce(title) + '"';
  return out + '>' + text + '</a>';
};

renderer.image = function (href, title, text) {
  if (!isAllowedUrl(href, IMAGE_SCHEMES)) return escapeHtmlOnce(text);

  var out = '<img src="' + escapeUrlAttribute(href) + '" alt="' + escapeHtmlOnce(text) + '"';
  if (title) out += ' title="' + escapeHtmlOnce(title) + '"';
  return out + '>';
};

renderer.html = function (html) {
  return escapeHtmlOnce(html);
};

var options = {
  renderer: renderer,
  gfm: true,
  sanitize: true,
  sanitizer: escapeHtmlOnce,
};

module.exports = function renderMarkdown(content) {
  if (content === null || content === undefined) return '';
  return marked(escapeMarkdownSource(content.toString()), options);
};

module.exports.isAllowedUrl = isAllowedUrl;
module.exports.resolveUrl = resolveUrl;
