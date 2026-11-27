var utils = require('../utils');
var mongoose = require('mongoose');
var Todo = mongoose.model('Todo');
var User = mongoose.model('User');
// TODO:
var { ms: hms } = require('humanize-ms');
var ms = require('ms');
var moment = require('moment');
var execFile = require('child_process').execFile;
var validator = require('validator');
var security = require('../lib/security');
var express = require('express');
var { rateLimit } = require('express-rate-limit');

var MAX_IMPORT_BYTES = 1024 * 1024;
var MAX_IMPORT_LINES = 1000;

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
  var username = typeof req.body.username === 'string' ? req.body.username : '';
  var password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!validator.isEmail(username)) {
    return res.status(401).send()
  }
  try {
    var user = await User.findOne({ username: { $eq: String(username) } })
      .setOptions({ sanitizeFilter: true })
      .exec();
    if (user && await security.verifyPassword(password, user.password)) {
      return adminLoginSuccess(req.body.redirectPage, req, username, res)
    }
    return res.status(401).send()
  } catch (err) {
    next(err);
  }
};

function adminLoginSuccess(redirectPage, req, username, res) {
  req.session.regenerate(function (err) {
    if (err) return res.status(500).send()
    req.session.loggedIn = 1

    // Log the login action for audit
    console.log('User logged in: %s', username)

    return res.redirect(security.safeRedirectPath(redirectPage, '/admin'))
  })
}

exports.login = function (req, res, next) {
  return res.render('admin', {
    title: 'Admin Access',
    granted: false,
    redirectPage: security.safeRedirectPath(req.query.redirectPage, '')
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

function asString(value) {
  return typeof value === 'string' ? value : '';
}

exports.save_account_details = function(req, res, next) {
  // get the profile details from the request, accepting only known string fields
  const profile = {
    firstname: asString(req.body.firstname),
    lastname: asString(req.body.lastname),
    country: asString(req.body.country),
    phone: asString(req.body.phone),
    email: asString(req.body.email)
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

    var period;
    try {
      period = hms(time);
    } catch (e) {
      period = undefined;
    }

    console.log('period: ' + period);

    // remove it
    t = t.slice(0, reminder);
    if (typeof period != 'undefined' && !Number.isNaN(period)) {
      t += ' [' + ms(period) + ']';
    }
  }
  return t;
}

function isHttpUrl(value) {
  try {
    var url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

exports.create = async function (req, res, next) {
  try {
    var item = req.body.content;
    if (typeof item !== 'string') {
      return res.status(400).send('Invalid content');
    }
    var imgRegex = /!\[alt text\]\((http\S*)\s".*/;
    var imgMatch = item.match(imgRegex);
    if (imgMatch) {
      var url = imgMatch[1];
      console.log('found img: %s', url);

      if (isHttpUrl(url) && !url.includes('\0')) {
        // execFile passes the URL as a single argument; no shell is involved.
        execFile('identify', [url], function (err, stdout, stderr) {
          if (err !== null) {
            console.log('Error (' + err + '):' + stderr);
          }
        });
      }
    } else {
      item = parse(item);
    }

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
    if (mongoose.isValidObjectId(req.params.id)) {
      await Todo.findByIdAndDelete(req.params.id).exec();
    }
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
    if (!mongoose.isValidObjectId(req.params.id) || typeof req.body.content !== 'string') {
      return res.redirect('/');
    }
    var todo = await Todo.findById(req.params.id).exec();
    if (todo) {
      todo.content = req.body.content;
      todo.updated_at = Date.now();
      await todo.save();
    }
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

function importLines(data) {
  var lines = data.split('\n').slice(0, MAX_IMPORT_LINES);
  var saves = [];
  lines.forEach(function (line) {
    var parts = line.split(',');
    var what = parts[0];
    console.log('importing %s', what);
    var when = parts[1];
    var locale = parts[2];
    var format = parts[3];
    var item = what;
    if (!isBlank(what)) {
      if (!isBlank(when) && !isBlank(locale) && !isBlank(format)) {
        console.log('setting locale %s', locale);
        var d = moment(when).locale(locale);
        console.log('formatting %s', d);
        item += ' [' + d.format(format) + ']';
      }

      saves.push(new Todo({
        content: item,
        updated_at: Date.now(),
      }).save());
    }
  });
  return Promise.all(saves);
}

exports.import = function (req, res, next) {
  if (!req.file) {
    res.send('No files were uploaded.');
    return;
  }

  var fileData = req.file.buffer;
  function done(data) {
    importLines(data).then(function () {
      res.redirect('/');
    }, next);
  }

  if (security.isZip(fileData)) {
    // Read backup.txt straight from the archive in memory; nothing is extracted to disk.
    security.readZipEntry(fileData, 'backup.txt', MAX_IMPORT_BYTES, function (err, entry) {
      if (err) {
        return res.status(400).send('Invalid zip file');
      }
      done(entry ? entry.toString('utf8') : 'No backup.txt file found');
    });
  } else {
    done(fileData.toString('utf8'));
  }
};

exports.about_new = function (req, res, next) {
  var device = typeof req.query.device === 'string' ? req.query.device : '';
  return res.render("about_new.dust",
    {
      title: 'Patch TODO List',
      subhead: 'Vulnerabilities at their best',
      device: device,
      isDesktop: device === 'Desktop'
    });
};

///////////////////////////////////////////////////////////////////////////////
// In order of simplicity we are not using any database. But you can write the
// same logic using MongoDB.
const users = [
  // Demo user credentials come from the environment; the user is disabled when unset.
  { name: 'user', password: process.env.CHAT_USER_PASSWORD },
  // You don't know password for the admin.
  { name: 'admin', password: require('crypto').randomBytes(16).toString('hex'), canDelete: true },
];

let messages = [];
let lastId = 1;

function findUser(auth) {
  return users.find((u) =>
    typeof u.password === 'string' &&
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

    const input = req.body.message || {};
    const message = {
      // Default message icon. Can be overwritten by user.
      icon: typeof input.icon === 'string' ? input.icon : '👋',
      text: typeof input.text === 'string' ? input.text : '',
      id: lastId++,
      timestamp: Date.now(),
      userName: user.name,
    };

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

var limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_MAX) || 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});

var router = express.Router();
router.get('/', limiter, exports.index);
router.get('/login', limiter, exports.login);
router.post('/login', limiter, exports.loginHandler);
router.get('/admin', limiter, exports.isLoggedIn, exports.admin);
router.get('/account_details', limiter, exports.isLoggedIn, exports.get_account_details);
router.post('/account_details', limiter, exports.isLoggedIn, exports.save_account_details);
router.get('/logout', limiter, exports.logout);
router.post('/create', limiter, exports.create);
router.get('/destroy/:id', limiter, exports.destroy);
router.get('/edit/:id', limiter, exports.edit);
router.post('/update/:id', limiter, exports.update);
router.post('/import', limiter, exports.import);
router.get('/about_new', limiter, exports.about_new);
router.get('/chat', limiter, exports.chat.get);
router.put('/chat', limiter, exports.chat.add);
router.delete('/chat', limiter, exports.chat.delete);

exports.limiter = limiter;
exports.router = router;
