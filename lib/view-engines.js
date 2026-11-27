var fs = require('fs');
var path = require('path');
var dust = require('dustjs-linkedin');
var Handlebars = require('handlebars');

function viewData(options) {
  var data = Object.assign({}, options);
  delete data.settings;
  delete data._locals;
  delete data.cache;
  delete data.layout;
  return data;
}

function dustEngine(filePath, options, callback) {
  var name = path.resolve(filePath);
  function render() {
    dust.render(name, viewData(options), callback);
  }
  if (dust.cache[name] && options.cache) return render();
  fs.readFile(name, 'utf8', function (err, source) {
    if (err) return callback(err);
    try {
      dust.loadSource(dust.compile(source, name));
    } catch (e) {
      return callback(e);
    }
    render();
  });
}

var hbsCache = {};

function compileHandlebars(filePath, useCache) {
  if (useCache && hbsCache[filePath]) return hbsCache[filePath];
  var template = Handlebars.compile(fs.readFileSync(filePath, 'utf8'));
  hbsCache[filePath] = template;
  return template;
}

// Renders a .hbs view inside views/layout.hbs. The layout is fixed and never
// taken from render data.
function handlebarsEngine(filePath, options, callback) {
  try {
    var data = viewData(options);
    var body = compileHandlebars(filePath, options.cache)(data);
    var layoutPath = path.join(path.dirname(filePath), 'layout.hbs');
    var layout = compileHandlebars(layoutPath, options.cache);
    callback(null, layout(Object.assign({}, data, { body: body })));
  } catch (e) {
    callback(e);
  }
}

module.exports = {
  dust: dustEngine,
  handlebars: handlebarsEngine
};
