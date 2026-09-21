var mongoose = require('mongoose');
var Todo = mongoose.model('Todo');
var User = mongoose.model('User');
var hms = require('humanize-ms');
var ms = require('ms');
var moment = require('moment');
var execFile = require('child_process').execFile;
var validator = require('validator');
var rateLimit = require('express-rate-limit');
var path = require('path');
var os = require('os');
var crypto = require('crypto');

var AdmZip = require('adm-zip');
var fs = require('fs');

exports.loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 });
exports.importLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 });

exports.index = async function (req, res, next) {
  try {
    var todos = await Todo.find({}).sort('-updated_at').exec();
    res.render('index', {
      title: 'Patch TODO List',
      subhead: 'Vulnerabilities at their best',
      todos: todos,
    });
  } catch (err) {
    next(err);
  }
};

exports.loginHandler = async function (req, res, next) {
  var username = req.body.username;
  var password = req.body.password;
  if (typeof username !== 'string' || typeof password !== 'string' || !validator.isEmail(username)) {
    return res.status(401).send();
  }
  try {
    var user = await User.findOne({ username: { $eq: String(username) } }).exec();
    if (user && await user.verifyPassword(password)) {
      return adminLoginSuccess(req.body.redirectPage, req.session, username, res);
    }
    return res.status(401).send();
  } catch (err) {
    next(err);
  }
};

var ALLOWED_REDIRECTS = ['/', '/admin', '/account_details', '/about_new'];

function safeRedirectPath(target) {
  var idx = ALLOWED_REDIRECTS.indexOf(target);
  return idx === -1 ? null : ALLOWED_REDIRECTS[idx];
}

function adminLoginSuccess(redirectPage, session, username, res) {
  session.loggedIn = 1

  // Log the login action for audit
  console.log(`User logged in: ${username}`)

  return res.redirect(safeRedirectPath(redirectPage) || '/admin')
}

exports.login = function (req, res, next) {
  return res.render('admin', {
    title: 'Admin Access',
    granted: false,
    redirectPage: safeRedirectPath(req.query.redirectPage) || ''
  });
};

exports.admin = function (req, res, next) {
  return res.render('admin', {
    title: 'Admin Access Granted',
    granted: true,
  });
};

exports.get_account_details = function(req, res, next) {
  // @TODO need to add a database call to get the profile from the database
  // and provide it to the view to display
  const profile = {}
 	return res.render('account.hbs', Object.assign({ layout: false }, profile))
}

exports.save_account_details = function(req, res, next) {
  // get the profile details from the JSON
	const profile = req.body
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

    // render the view
    return res.render('account.hbs', Object.assign({ layout: false }, profile))
  } else {
    // if input validation fails, we just render the view as is
    console.log('error in form details')
    return res.render('account.hbs', { layout: false })
  }
}

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

exports.create = async function (req, res, next) {
  var item = req.body.content;
  var imgRegex = /\!\[alt text\]\((http.*)\s\".*/;
  if (typeof (item) == 'string' && item.match(imgRegex)) {
    var url = item.match(imgRegex)[1];
    console.log('found img: ' + url);

    if (validator.isURL(url, { protocols: ['http', 'https'], require_protocol: true })) {
      execFile('identify', [url], function (err, stdout, stderr) {
        if (err !== null) {
          console.log('Error (' + err + '):' + stderr);
        }
      });
    }

  } else {
    item = parse(item);
  }

  try {
    var todo = await new Todo({
      content: item,
      updated_at: Date.now(),
    }).save();

    res.setHeader('Location', '/');
    res.status(302).send(todo.content.toString('base64'));
  } catch (err) {
    next(err);
  }
};

exports.destroy = async function (req, res, next) {
  try {
    await Todo.findByIdAndDelete(req.params.id).exec();
    res.redirect('/');
  } catch (err) {
    next(err);
  }
};

exports.edit = async function (req, res, next) {
  try {
    var todos = await Todo.find({}).sort('-updated_at').exec();
    res.render('edit', {
      title: 'TODO',
      todos: todos,
      current: req.params.id
    });
  } catch (err) {
    next(err);
  }
};

exports.update = async function (req, res, next) {
  try {
    var todo = await Todo.findById(req.params.id).exec();
    if (!todo) return res.redirect('/');
    todo.content = req.body.content;
    todo.updated_at = Date.now();
    await todo.save();
    res.redirect('/');
  } catch (err) {
    next(err);
  }
};

// ** express turns the cookie key to lowercase **
exports.current_user = function (req, res, next) {

  next();
};

function isBlank(str) {
  return (!str || /^\s*$/.test(str));
}

exports.import = async function (req, res, next) {
  if (!req.files || !req.files.importFile) {
    res.send('No files were uploaded.');
    return;
  }

  var importFile = req.files.importFile;
  var data;
  var extracted_path;
  try {
    var { fileTypeFromBuffer } = await import('file-type');
    var importedFileType = await fileTypeFromBuffer(importFile.data);
    var zipFileExt = { ext: "zip", mime: "application/zip" };
    if (!importedFileType) {
      importedFileType = { ext: "txt", mime: "text/plain" };
    }
    if (importedFileType["mime"] === zipFileExt["mime"]) {
      var zip = new AdmZip(importFile.data);
      extracted_path = fs.mkdtempSync(path.join(os.tmpdir(), 'extracted_files-'));
      zip.extractAllTo(extracted_path, true);
      data = "No backup.txt file found";
      try {
        data = fs.readFileSync(path.join(extracted_path, 'backup.txt'), 'ascii');
      } catch (e) {
      }
    } else {
      data = importFile.data.toString('ascii');
    }
    var lines = data.split('\n');
    for (const line of lines) {
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

        var todo = await new Todo({
          content: item,
          updated_at: Date.now(),
        }).save();
        console.log('added ' + todo);
      }
    }
  } catch (err) {
    return next(err);
  } finally {
    if (extracted_path) {
      fs.rmSync(extracted_path, { recursive: true, force: true });
    }
  }

  res.redirect('/');
};

exports.about_new = function (req, res, next) {
  return res.render("about_new.dust",
    {
      layout: false,
      title: 'Patch TODO List',
      subhead: 'Vulnerabilities at their best',
      device: req.query.device,
      isDesktop: req.query.device === 'Desktop'
    });
};

///////////////////////////////////////////////////////////////////////////////
// In order of simplicity we are not using any database. But you can write the
// same logic using MongoDB.
const users = [
  // You know password for the user.
  { name: 'user', password: process.env.CHAT_USER_PASSWORD || crypto.randomBytes(8).toString('hex') },
  // You don't know password for the admin.
  { name: 'admin', password: crypto.randomBytes(16).toString('hex'), canDelete: true },
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

    const incoming = req.body.message;
    const message = {
      // Default message icon. Can be overwritten by user.
      icon: '👋',
      text: incoming && typeof incoming.text === 'string' ? incoming.text : '',
      id: lastId++,
      timestamp: Date.now(),
      userName: user.name,
    };
    if (incoming && typeof incoming.icon === 'string') {
      message.icon = incoming.icon;
    }

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
