var { Marked } = require('marked');

var SAFE_SCHEME = /^(https?|mailto):/i;
var HAS_SCHEME = /^[^\/?#]*:/;

// Allows http(s)/mailto links and same-origin relative URLs; blocks other schemes
// (javascript:, data:, ...) and protocol-relative URLs. Browsers ignore control
// characters and whitespace inside schemes, so they are stripped before checking.
function isSafeUrl(href) {
  var url = String(href).replace(/[\u0000-\u0020\u007f]/g, '');
  if (SAFE_SCHEME.test(url)) return true;
  // Browsers decode character references in href, so an entity before the first path
  // delimiter could hide a ':' (e.g. &colon; or &#58).
  return !HAS_SCHEME.test(url) && !/^[^\/?#]*&(#|[a-z][a-z0-9]*;)/i.test(url) &&
    !/^[\/\\]{2}/.test(url) && !/^\/\\/.test(url);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Markdown renderer that escapes raw HTML and drops non-http(s) link targets.
var marked = new Marked({
  renderer: {
    html: function (token) {
      return escapeHtml(token.text);
    }
  },
  walkTokens: function (token) {
    if ((token.type === 'link' || token.type === 'image') && !isSafeUrl(token.href)) {
      token.href = '#';
    }
  }
});

module.exports = function renderMarkdown(src) {
  return marked.parse(String(src));
};
module.exports.escapeHtml = escapeHtml;
