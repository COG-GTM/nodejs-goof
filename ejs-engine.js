var path = require('path');
var ejs = require('ejs');

// Express view engine for EJS views that call layout('name') to wrap their
// output in another template (the only ejs-locals feature the views use).
// Compile options are passed separately so render data can never set them.
function renderFile(file, options, callback) {
  var layoutName;
  var locals = Object.assign({}, options, {
    layout: function (name) { layoutName = name; }
  });
  var ejsOptions = { cache: Boolean(options.cache) };

  ejs.renderFile(file, locals, ejsOptions, function (err, body) {
    if (err || !layoutName) return callback(err, body);
    var layoutFile = path.resolve(path.dirname(file), layoutName);
    if (!path.extname(layoutFile)) layoutFile += '.ejs';
    renderFile(layoutFile, Object.assign({}, options, { body: body }), callback);
  });
}

module.exports = renderFile;
