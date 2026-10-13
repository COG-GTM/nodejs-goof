var { Marked } = require('marked');
var sanitizeHtml = require('sanitize-html');

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Show raw HTML in todos as text (as marked's old `sanitize` option did)
var marked = new Marked({
  renderer: {
    html: function (token) { return escapeHtml(token.text); }
  }
});

var sanitizeOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img'])
};

// Render markdown to HTML, then sanitize the output (marked no longer sanitizes)
module.exports = function renderMarkdown(src) {
  return sanitizeHtml(marked.parse(String(src)), sanitizeOptions);
};
