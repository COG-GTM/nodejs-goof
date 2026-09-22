var utils = require('../utils');
var mongoose = require('mongoose');
var Todo = mongoose.model('Todo');
var User = mongoose.model('User');
// TODO:
var hms = require('humanize-ms');
var ms = require('ms');
var streamBuffers = require('stream-buffers');
var readline = require('readline');
var moment = require('moment');
var execFile = require('child_process').execFile;
var validator = require('validator');

// zip-slip
var fileType = require('file-type');
var AdmZip = require('adm-zip');
var fs = require('fs');
var os = require('os');
var path = require('path');
var dns = require('dns');
var net = require('net');

var MAX_IMPORT_LINES = 1000;

// prototype-pollution
var _ = require('lodash');

// Expensive handlers (rendering, database access, archive extraction) are
// throttled individually on top of the global limiter in app.js.
var { rateLimit } = require('express-rate-limit');
var limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});

exports.index = [limiter, function (req, res, next) {
  Todo.
    find({}).
    sort('-updated_at').
    then(function (todos) {
      res.render('index', {
        title: 'Patch TODO List',
        subhead: 'Vulnerabilities at their best',
        todos: todos,
      });
    }).
    catch(next);
}];

exports.loginHandler = function (req, res, next) {
  var username = req.body.username;
  var password = req.body.password;

  // Only accept scalar credentials so that query operators cannot be smuggled
  // in through a JSON body (NoSQL injection).
  if (typeof username !== 'string' || typeof password !== 'string' || !validator.isEmail(username)) {
    return res.status(401).send();
  }

  User.find({ username: { $eq: String(username) }, password: { $eq: String(password) } }).
    then(function (users) {
      if (users.length > 0) {
        return adminLoginSuccess(req.body.redirectPage, req.session, username, res);
      }
      return res.status(401).send();
    }).
    catch(next);
};

// Only same-site, non protocol-relative paths are accepted as a redirect
// target, otherwise the login form can be used to redirect to an attacker
// controlled site (open redirect).
function safeRedirectPage(redirectPage) {
  if (typeof redirectPage === 'string' && /^\/([^/\\].*)?$/.test(redirectPage)) {
    return redirectPage;
  }
  return '/admin';
}

function adminLoginSuccess(redirectPage, session, username, res) {
  session.loggedIn = 1

  // Log the login action for audit
  console.log(`User logged in: ${username}`)

  return res.redirect(safeRedirectPage(redirectPage))
}

exports.login = [limiter, function (req, res, next) {
  return res.render('admin', {
    title: 'Admin Access',
    granted: false,
    redirectPage: safeRedirectPage(req.query.redirectPage)
  });
}];

exports.admin = [limiter, function (req, res, next) {
  return res.render('admin', {
    title: 'Admin Access Granted',
    granted: true,
  });
}];

exports.get_account_details = [limiter, function(req, res, next) {
  // @TODO need to add a database call to get the profile from the database
  // and provide it to the view to display
  const profile = { layout: false }
 	return res.render('account.hbs', profile)
}]

exports.save_account_details = [limiter, function(req, res, next) {
  // get the profile details from the JSON
	const profile = req.body
  // the validators below assert on their argument, so anything but a string
  // has to be rejected up front
  const fields = ['email', 'phone', 'firstname', 'lastname', 'country']
  if (fields.some(function (field) { return typeof profile[field] !== 'string' })) {
    console.log('error in form details')
    return res.render('account.hbs', { layout: false })
  }

  // validate the input
  if (validator.isEmail(profile.email, { allow_display_name: true })
    // allow_display_name allows us to receive input as:
    // Display Name <email-address>
    // which we consider valid too
    && validator.isMobilePhone(profile.phone, 'he-IL')
    && validator.isAscii(profile.firstname)
    && validator.isAscii(profile.lastname)
    && validator.isAscii(profile.country)
  ) {
    // trim any extra spaces on the right of the name
    profile.firstname = validator.rtrim(profile.firstname)
    profile.lastname = validator.rtrim(profile.lastname)
    profile.layout = false

    // render the view
    return res.render('account.hbs', profile)
  } else {
    // if input validation fails, we just render the view as is
    console.log('error in form details')
    return res.render('account.hbs', { layout: false })
  }
}]

exports.isLoggedIn = function (req, res, next) {
  if (req.session.loggedIn === 1) {
    return next()
  } else {
    return res.redirect('/')
  }
}

exports.logout = function (req, res, next) {
  req.session.loggedIn = 0
  req.session.destroy(function() { 
    return res.redirect('/')  
  })
}

function parse(todo) {
  var t = todo;

  var remindToken = ' in ';
  var reminder = t.toString().indexOf(remindToken);
  if (reminder > 0) {
    var time = t.slice(reminder + remindToken.length);
    time = time.replace(/\n$/, '');

    var period = hms(time);

    console.log('period: ' + period);

    // remove it
    t = t.slice(0, reminder);
    if (typeof period != 'undefined') {
      t += ' [' + ms(period) + ']';
    }
  }
  return t;
}

// The image URL is passed to an external binary, so it has to be a plain
// http(s) URL and it is passed as an argument instead of through a shell.
function isSafeImageUrl(url) {
  try {
    var parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

// Addresses that are only reachable from the server itself, its network or a
// cloud metadata service must not be requested on behalf of a client.
function isInternalAddress(address) {
  var normalized = address.toLowerCase().split('%')[0];

  if (normalized.startsWith('::ffff:')) {
    normalized = normalized.slice(7);
  }

  if (net.isIPv4(normalized)) {
    var octets = normalized.split('.').map(Number);
    return octets[0] === 0 ||
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168) ||
      octets[0] >= 224;
  }

  return normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80');
}

// Resolving the host up front keeps the obvious server-side request forgery
// targets (loopback, private ranges, link-local metadata services) out of reach.
function resolvesToPublicHost(url, callback) {
  var hostname = new URL(url).hostname.replace(/^\[|\]$/g, '');

  if (net.isIP(hostname)) {
    return callback(!isInternalAddress(hostname));
  }

  dns.lookup(hostname, { all: true }, function (err, addresses) {
    if (err || addresses.length === 0) {
      return callback(false);
    }
    callback(addresses.every(function (entry) {
      return !isInternalAddress(entry.address);
    }));
  });
}

exports.create = [limiter, function (req, res, next) {
  // console.log('req.body: ' + JSON.stringify(req.body));

  var item = req.body.content;
  var imgRegex = /\!\[alt text\]\((http[^\s"]*)\s\".*/;
  if (typeof (item) == 'string' && item.match(imgRegex)) {
    var url = item.match(imgRegex)[1];
    console.log('found img: ' + url);

    if (!isSafeImageUrl(url)) {
      return res.status(400).send('Invalid image URL');
    }

    resolvesToPublicHost(url, function (isPublic) {
      if (!isPublic) {
        console.log('refusing to identify an image hosted on an internal address');
        return;
      }

      execFile('identify', [url], function (err, stdout, stderr) {
        if (err !== null) {
          console.log('Error (' + err + '):' + stderr);
        }
      });
    });

  } else {
    item = parse(item);
  }

  new Todo({
    content: item,
    updated_at: Date.now(),
  }).save().
    then(function (todo) {
      res.setHeader('Location', '/');
      res.status(302).send(todo.content.toString('base64'));
    }).
    catch(next);
}];

exports.destroy = [limiter, function (req, res, next) {
  Todo.findByIdAndDelete(req.params.id).
    then(function () {
      res.redirect('/');
    }).
    catch(next);
}];

exports.edit = [limiter, function (req, res, next) {
  Todo.
    find({}).
    sort('-updated_at').
    then(function (todos) {
      res.render('edit', {
        title: 'TODO',
        todos: todos,
        current: req.params.id
      });
    }).
    catch(next);
}];

exports.update = [limiter, function (req, res, next) {
  Todo.findById(req.params.id).
    then(function (todo) {
      if (!todo) {
        return res.status(404).send();
      }

      todo.content = req.body.content;
      todo.updated_at = Date.now();
      return todo.save().then(function () {
        res.redirect('/');
      });
    }).
    catch(next);
}];

// ** express turns the cookie key to lowercase **
exports.current_user = function (req, res, next) {

  next();
};

function isBlank(str) {
  return (!str || /^\s*$/.test(str));
}

exports.import = [limiter, function (req, res, next) {
  if (!req.file) {
    res.send('No files were uploaded.');
    return;
  }

  var importFile = req.file;
  var data;
  var importedFileType = fileType(importFile.buffer);
  var zipFileExt = { ext: "zip", mime: "application/zip" };
  if (importedFileType === null) {
    importedFileType = { ext: "txt", mime: "text/plain" };
  }
  if (importedFileType["mime"] === zipFileExt["mime"]) {
    var zip = new AdmZip(importFile.buffer);

    // Extract into a directory of its own so that concurrent imports cannot
    // overwrite each other, and only take the single entry we are interested
    // in so that an archive cannot drop arbitrary files on the host.
    var extracted_path = fs.mkdtempSync(path.join(os.tmpdir(), 'extracted_files-'));
    var backupEntry = zip.getEntries().find(function (entry) {
      return !entry.isDirectory && path.basename(entry.entryName) === 'backup.txt';
    });

    data = "No backup.txt file found";
    if (backupEntry) {
      zip.extractEntryTo(backupEntry, extracted_path, false, true, false, 'backup.txt');
      data = fs.readFileSync(path.join(extracted_path, 'backup.txt'), 'ascii');
    }
    fs.rmSync(extracted_path, { recursive: true, force: true });
  } else {
    data = importFile.buffer.toString('ascii');
  }

  // Cap the amount of work a single import can queue up.
  var lines = data.split('\n').slice(0, MAX_IMPORT_LINES);
  lines.forEach(function (line) {
    var parts = line.split(',');
    var what = parts[0];
    console.log('importing ' + what);
    var when = parts[1];
    var locale = parts[2];
    var format = parts[3];
    var item = what;
    if (!isBlank(what)) {
      if (!isBlank(when) && !isBlank(locale) && !isBlank(format)) {
        console.log('setting locale ' + parts[1]);
        moment.locale(locale);
        var d = moment(when);
        console.log('formatting ' + d);
        item += ' [' + d.format(format) + ']';
      }

      new Todo({
        content: item,
        updated_at: Date.now(),
      }).save().
        then(function (todo) {
          console.log('added ' + todo);
        }).
        catch(function (err) {
          // The redirect below has already ended the response, so a failing
          // line is logged instead of being passed to the error handler.
          console.log('failed to import an item: ' + err);
        });
    }
  });

  res.redirect('/');
}];

exports.about_new = [limiter, function (req, res, next) {
  console.log(JSON.stringify(req.query));
  return res.render("about_new",
    {
      layout: false,
      title: 'Patch TODO List',
      subhead: 'Vulnerabilities at their best',
      device: req.query.device,
      isDesktop: req.query.device === 'Desktop'
    });
}];

// Prototype Pollution

///////////////////////////////////////////////////////////////////////////////
// In order of simplicity we are not using any database. But you can write the
// same logic using MongoDB.
const users = [
  // You know password for the user.
  { name: 'user', password: 'pwd' },
  // You don't know password for the admin.
  { name: 'admin', password: Math.random().toString(32), canDelete: true },
];

let messages = [];
let lastId = 1;

function findUser(auth) {
  return users.find((u) =>
    u.name === auth.name &&
    u.password === auth.password);
}
///////////////////////////////////////////////////////////////////////////////

exports.chat = {
  get(req, res) {
    res.send(messages);
  },
  add(req, res) {
    const user = findUser(req.body.auth || {});

    if (!user) {
      res.status(403).send({ ok: false, error: 'Access denied' });
      return;
    }

    const message = {
      // Default message icon. Cen be overwritten by user.
      icon: '👋',
    };

    _.merge(message, req.body.message, {
      id: lastId++,
      timestamp: Date.now(),
      userName: user.name,
    });

    messages.push(message);
    res.send({ ok: true });
  },
  delete(req, res) {
    const user = findUser(req.body.auth || {});

    if (!user || !user.canDelete) {
      res.status(403).send({ ok: false, error: 'Access denied' });
      return;
    }

    messages = messages.filter((m) => m.id !== req.body.messageId);
    res.send({ ok: true });
  }
};
