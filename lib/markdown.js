var { Marked } = require('marked');

var SAFE_URL = /^(https?:|mailto:|\/(?![\/\\])|#)/i;

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
    if ((token.type === 'link' || token.type === 'image') && !SAFE_URL.test(token.href)) {
      token.href = '#';
    }
  }
});

module.exports = function renderMarkdown(src) {
  return marked.parse(String(src));
};
module.exports.escapeHtml = escapeHtml;
