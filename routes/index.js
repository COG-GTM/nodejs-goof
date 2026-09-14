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


exports.index = function (req, res, next) {
  Todo.
    find({}).
    sort('-updated_at').
    exec().
    then(function (todos) {
      res.render('index', {
        title: 'Patch TODO List',
        subhead: 'Vulnerabilities at their best',
        todos: todos,
      });
    }, next);
};

exports.loginHandler = function (req, res, next) {
  const username = req.body.username
  const password = req.body.password
  if (typeof username !== 'string' || typeof password !== 'string' || !validator.isEmail(username)) {
    return res.status(401).send()
  }
  User.find({ username: { $eq: username }, password: { $eq: password } }).exec().then(function (users) {
    if (users.length > 0) {
      const redirectPage = req.body.redirectPage
      const session = req.session
      return adminLoginSuccess(redirectPage, session, username, res)
    } else {
      return res.status(401).send()
    }
  }, next);
};

function adminLoginSuccess(redirectPage, session, username, res) {
  session.loggedIn = 1

  // Log the login action for audit
  console.log(`User logged in: ${username}`)

  if (redirectPage) {
      return res.redirect(redirectPage)
  } else {
      return res.redirect('/admin')
  }
}

exports.login = function (req, res, next) {
  return res.render('admin', {
    title: 'Admin Access',
    granted: false,
    redirectPage: req.query.redirectPage
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
 	return res.render('account.hbs', profile)
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
    return res.render('account.hbs', profile)
  } else {
    // if input validation fails, we just render the view as is
    console.log('error in form details')
    return res.render('account.hbs')
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

exports.create = function (req, res, next) {
  // console.log('req.body: ' + JSON.stringify(req.body));

  var item = req.body.content;
  if (typeof item !== 'string') {
    return res.status(400).send('content must be a string');
  }
  var imgRegex = /\!\[alt text\]\((http\S*)\s\".*/;
  if (item.match(imgRegex)) {
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

  new Todo({
    content: item,
    updated_at: Date.now(),
  }).save().then(function (todo) {
    /*
    res.setHeader('Data', todo.content.toString('base64'));
    res.redirect('/');
    */

    res.setHeader('Location', '/');
    res.status(302).send(todo.content.toString('base64'));

    // res.redirect('/#' + todo.content.toString('base64'));
  }, next);
};

exports.destroy = function (req, res, next) {
  Todo.findByIdAndDelete(req.params.id).exec().then(function () {
    res.redirect('/');
  }, next);
};

exports.edit = function (req, res, next) {
  Todo.
    find({}).
    sort('-updated_at').
    exec().
    then(function (todos) {
      res.render('edit', {
        title: 'TODO',
        todos: todos,
        current: req.params.id
      });
    }, next);
};

exports.update = function (req, res, next) {
  Todo.findById(req.params.id).exec().then(function (todo) {
    if (!todo) return res.redirect('/');
    todo.content = req.body.content;
    todo.updated_at = Date.now();
    return todo.save().then(function () {
      res.redirect('/');
    });
  }).catch(next);
};

// ** express turns the cookie key to lowercase **
exports.current_user = function (req, res, next) {

  next();
};

function isBlank(str) {
  return (!str || /^\s*$/.test(str));
}

exports.import = function (req, res, next) {
  if (!req.files) {
    res.send('No files were uploaded.');
    return;
  }

  var importFile = req.files.importFile;
  var data;
  var importedFileType = fileType(importFile.data);
  var zipFileExt = { ext: "zip", mime: "application/zip" };
  if (importedFileType === null) {
    importedFileType = { ext: "txt", mime: "text/plain" };
  }
  if (importedFileType["mime"] === zipFileExt["mime"]) {
    var zip = AdmZip(importFile.data);
    var extracted_path = "/tmp/extracted_files";
    zip.extractAllTo(extracted_path, true);
    data = "No backup.txt file found";
    fs.readFile('backup.txt', 'ascii', function (err, data) {
      if (!err) {
        data = data;
      }
    });
  } else {
    data = importFile.data.toString('ascii');
  }
  var lines = data.split('\n');
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
      }).save().then(function (todo) {
        console.log('added ' + todo);
      }, function (err) {
        console.error(err);
      });
    }
  });

  res.redirect('/');
};

exports.about_new = function (req, res, next) {
  const device = typeof req.query.device === 'string' ? req.query.device : '';
  return res.render("about_new.dust",
    {
      title: 'Patch TODO List',
      subhead: 'Vulnerabilities at their best',
      device: device,
      isDesktop: device === 'Desktop'
    });
};

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

function canDelete(user) {
  return Object.prototype.hasOwnProperty.call(user, 'canDelete') && user.canDelete === true;
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Copies only own, string-valued fields from an untrusted message body.
function sanitizeMessage(input) {
  const out = {};
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return out;
  }
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    const value = input[key];
    if (typeof value === 'string') {
      out[key] = value;
    }
  }
  return out;
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

    const message = Object.assign(
      {
        // Default message icon. Can be overwritten by user.
        icon: '👋',
      },
      sanitizeMessage(req.body.message),
      {
        id: lastId++,
        timestamp: Date.now(),
        userName: user.name,
      }
    );

    messages.push(message);
    res.send({ ok: true });
  },
  delete(req, res) {
    const user = findUser(req.body.auth || {});

    if (!user || !canDelete(user)) {
      res.status(403).send({ ok: false, error: 'Access denied' });
      return;
    }

    messages = messages.filter((m) => m.id !== req.body.messageId);
    res.send({ ok: true });
  }
};
