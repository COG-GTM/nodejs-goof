import { Request, Response, NextFunction } from 'express';
import { Session, SessionData } from 'express-session';
import utils from '../utils';
import mongoose = require('mongoose');
import { TodoDocument, UserDocument } from '../mongoose-db';
var Todo = mongoose.model('Todo');
var User = mongoose.model('User');
// TODO:
import hms from 'humanize-ms';
import ms from 'ms';
import streamBuffers from 'stream-buffers';
import readline from 'readline';
import moment from 'moment';
import { exec } from 'child_process';
import validator from 'validator';

// zip-slip
import fileType from 'file-type';
import AdmZip from 'adm-zip';
import fs from 'fs';

// prototype-pollution
import _ from 'lodash';

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;

export const index: Handler = function (req, res, next) {
  Todo.
    find({}).
    sort('-updated_at').
    exec(function (err: Error | null, todos: TodoDocument[]) {
      if (err) return next(err);

      res.render('index', {
        title: 'Patch TODO List',
        subhead: 'Vulnerabilities at their best',
        todos: todos,
      });
    });
};

export const loginHandler: Handler = function (req, res, next) {
  if (validator.isEmail(req.body.username)) {
    User.find({ username: req.body.username, password: req.body.password }, function (err: Error | null, users: UserDocument[]) {
      if (users.length > 0) {
        const redirectPage = req.body.redirectPage
        const session = req.session
        const username = req.body.username
        return adminLoginSuccess(redirectPage, session, username, res)
      } else {
        return res.status(401).send()
      }
    });
  } else {
    return res.status(401).send()
  }
};

function adminLoginSuccess(redirectPage: string | undefined, session: Session & Partial<SessionData>, username: string, res: Response) {
  session.loggedIn = 1

  // Log the login action for audit
  console.log(`User logged in: ${username}`)

  if (redirectPage) {
      return res.redirect(redirectPage)
  } else {
      return res.redirect('/admin')
  }
}

export const login: Handler = function (req, res, next) {
  return res.render('admin', {
    title: 'Admin Access',
    granted: false,
    redirectPage: req.query.redirectPage
  });
};

export const admin: Handler = function (req, res, next) {
  return res.render('admin', {
    title: 'Admin Access Granted',
    granted: true,
  });
};

export const get_account_details: Handler = function (req, res, next) {
  // @TODO need to add a database call to get the profile from the database
  // and provide it to the view to display
  const profile = {}
 	return res.render('account.hbs', profile)
}

export const save_account_details: Handler = function (req, res, next) {
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

export const isLoggedIn: Handler = function (req, res, next) {
  if (req.session.loggedIn === 1) {
    return next()
  } else {
    return res.redirect('/')
  }
}

export const logout: Handler = function (req, res, next) {
  req.session.loggedIn = 0
  req.session.destroy(function() { 
    return res.redirect('/')  
  })
}

function parse(todo: any) {
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

export const create: Handler = function (req, res, next) {
  // console.log('req.body: ' + JSON.stringify(req.body));

  var item = req.body.content;
  var imgRegex = /\!\[alt text\]\((http.*)\s\".*/;
  if (typeof (item) == 'string' && item.match(imgRegex)) {
    var url = item.match(imgRegex)![1];
    console.log('found img: ' + url);

    exec('identify ' + url, function (err: Error | null, stdout: string, stderr: string) {
      console.log(err);
      if (err !== null) {
        console.log('Error (' + err + '):' + stderr);
      }
    });

  } else {
    item = parse(item);
  }

  new Todo({
    content: item,
    updated_at: Date.now(),
  }).save(function (err: Error | null, todo: TodoDocument, count?: number) {
    if (err) return next(err);

    /*
    res.setHeader('Data', todo.content.toString('base64'));
    res.redirect('/');
    */

    res.setHeader('Location', '/');
    res.status(302).send(todo.content.toString('base64'));

    // res.redirect('/#' + todo.content.toString('base64'));
  });
};

export const destroy: Handler = function (req, res, next) {
  Todo.findById(req.params.id, function (err: Error | null, todo: TodoDocument) {

    try {
      todo.remove(function (err: Error | null, todo: TodoDocument) {
        if (err) return next(err);
        res.redirect('/');
      });
    } catch (e) {
    }
  });
};

export const edit: Handler = function (req, res, next) {
  Todo.
    find({}).
    sort('-updated_at').
    exec(function (err: Error | null, todos: TodoDocument[]) {
      if (err) return next(err);

      res.render('edit', {
        title: 'TODO',
        todos: todos,
        current: req.params.id
      });
    });
};

export const update: Handler = function (req, res, next) {
  Todo.findById(req.params.id, function (err: Error | null, todo: TodoDocument) {

    todo.content = req.body.content;
    todo.updated_at = Date.now();
    todo.save(function (err: Error | null, todo: TodoDocument, count?: number) {
      if (err) return next(err);

      res.redirect('/');
    });
  });
};

// ** express turns the cookie key to lowercase **
export const current_user: Handler = function (req, res, next) {

  next();
};

function isBlank(str: string | undefined) {
  return (!str || /^\s*$/.test(str));
}

const importTodos: Handler = function (req, res, next) {
  if (!req.files) {
    res.send('No files were uploaded.');
    return;
  }

  var importFile = req.files.importFile;
  var data: string;
  var importedFileType: { ext: string; mime: string } | null = fileType(importFile.data);
  var zipFileExt = { ext: "zip", mime: "application/zip" };
  if (importedFileType === null) {
    importedFileType = { ext: "txt", mime: "text/plain" };
  }
  if (importedFileType["mime"] === zipFileExt["mime"]) {
    var zip = new AdmZip(importFile.data);
    var extracted_path = "/tmp/extracted_files";
    zip.extractAllTo(extracted_path, true);
    data = "No backup.txt file found";
    fs.readFile('backup.txt', 'ascii', function (err: NodeJS.ErrnoException | null, data: string) {
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
      }).save(function (err: Error | null, todo: TodoDocument, count?: number) {
        if (err) return next(err);
        console.log('added ' + todo);
      });
    }
  });

  res.redirect('/');
};

export { importTodos as import };

export const about_new: Handler = function (req, res, next) {
  console.log(JSON.stringify(req.query));
  return res.render("about_new.dust",
    {
      title: 'Patch TODO List',
      subhead: 'Vulnerabilities at their best',
      device: req.query.device
    });
};

// Prototype Pollution

///////////////////////////////////////////////////////////////////////////////
// In order of simplicity we are not using any database. But you can write the
// same logic using MongoDB.
interface ChatUser {
  name: string;
  password: string;
  canDelete?: boolean;
}

interface ChatMessage {
  id?: number;
  icon?: string;
  timestamp?: number;
  userName?: string;
  [key: string]: unknown;
}

const users: ChatUser[] = [
  // You know password for the user.
  { name: 'user', password: 'pwd' },
  // You don't know password for the admin.
  { name: 'admin', password: Math.random().toString(32), canDelete: true },
];

let messages: ChatMessage[] = [];
let lastId = 1;

function findUser(auth: Partial<ChatUser>) {
  return users.find((u) =>
    u.name === auth.name &&
    u.password === auth.password);
}
///////////////////////////////////////////////////////////////////////////////

export const chat = {
  get(req: Request, res: Response) {
    res.send(messages);
  },
  add(req: Request, res: Response) {
    const user = findUser(req.body.auth || {});

    if (!user) {
      res.status(403).send({ ok: false, error: 'Access denied' });
      return;
    }

    const message: ChatMessage = {
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
  delete(req: Request, res: Response) {
    const user = findUser(req.body.auth || {});

    if (!user || !user.canDelete) {
      res.status(403).send({ ok: false, error: 'Access denied' });
      return;
    }

    messages = messages.filter((m) => m.id !== req.body.messageId);
    res.send({ ok: true });
  }
};
