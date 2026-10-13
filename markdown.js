var { marked } = require('marked');
var sanitizeHtml = require('sanitize-html');

var sanitizeOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img'])
};

// Render markdown to HTML, then sanitize the output (marked no longer sanitizes)
module.exports = function renderMarkdown(src) {
  return sanitizeHtml(marked.parse(String(src)), sanitizeOptions);
};
