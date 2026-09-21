const { test } = require('tap');
const { registerModels, fakeRes } = require('./helpers/stubs');

registerModels();
const routes = require('../routes');

test('current_user passes the request on', (t) => {
  t.plan(1);
  routes.current_user({}, fakeRes(), () => t.pass('next called'));
});

test('login renders the admin view without access and keeps the redirect target', (t) => {
  const res = fakeRes();
  routes.login({ query: { redirectPage: '/admin' } }, res);
  t.equal(res.rendered.view, 'admin');
  t.equal(res.rendered.locals.granted, false);
  t.equal(res.rendered.locals.redirectPage, '/admin');
  t.end();
});

test('admin renders the admin view with access granted', (t) => {
  const res = fakeRes();
  routes.admin({}, res);
  t.equal(res.rendered.view, 'admin');
  t.equal(res.rendered.locals.granted, true);
  t.end();
});

test('isLoggedIn only lets a logged in session through', (t) => {
  t.plan(3);

  routes.isLoggedIn({ session: { loggedIn: 1 } }, fakeRes(), () => t.pass('next called'));

  const res = fakeRes();
  routes.isLoggedIn({ session: {} }, res, () => t.fail('next must not be called'));
  t.equal(res.redirectedTo, '/');

  const truthyButNotOne = fakeRes();
  routes.isLoggedIn({ session: { loggedIn: true } }, truthyButNotOne, () => t.fail('next must not be called'));
  t.equal(truthyButNotOne.redirectedTo, '/');
});

test('logout clears and destroys the session before redirecting home', (t) => {
  const res = fakeRes();
  const session = {
    loggedIn: 1,
    destroy(cb) {
      session.destroyed = true;
      cb();
    },
  };
  routes.logout({ session }, res);
  t.equal(session.loggedIn, 0);
  t.ok(session.destroyed);
  t.equal(res.redirectedTo, '/');
  t.end();
});

test('get_account_details renders an empty account view', (t) => {
  const res = fakeRes();
  routes.get_account_details({}, res);
  t.equal(res.rendered.view, 'account.hbs');
  t.same(res.rendered.locals, {});
  t.end();
});

test('save_account_details renders the submitted profile with trimmed names', (t) => {
  const res = fakeRes();
  routes.save_account_details({
    body: {
      email: 'Jane Doe <jane@example.com>',
      phone: '0541234567',
      firstname: 'Jane   ',
      lastname: 'Doe  ',
      country: 'Israel',
    },
  }, res);
  t.equal(res.rendered.view, 'account.hbs');
  t.equal(res.rendered.locals.firstname, 'Jane');
  t.equal(res.rendered.locals.lastname, 'Doe');
  t.equal(res.rendered.locals.email, 'Jane Doe <jane@example.com>');
  t.end();
});

test('save_account_details drops the profile when validation fails', (t) => {
  const res = fakeRes();
  routes.save_account_details({
    body: {
      email: 'not-an-email',
      phone: '0541234567',
      firstname: 'Jane',
      lastname: 'Doe',
      country: 'Israel',
    },
  }, res);
  t.equal(res.rendered.view, 'account.hbs');
  t.equal(res.rendered.locals, undefined);
  t.end();
});

test('chat rejects unauthenticated writes and deletes', (t) => {
  const addRes = fakeRes();
  routes.chat.add({ body: { message: { text: 'hi' } } }, addRes);
  t.equal(addRes.statusCode, 403);
  t.same(addRes.body, { ok: false, error: 'Access denied' });

  const deleteRes = fakeRes();
  routes.chat.delete({ body: { auth: { name: 'user', password: 'pwd' }, messageId: 1 } }, deleteRes);
  t.equal(deleteRes.statusCode, 403, 'a user without canDelete cannot delete');
  t.end();
});

test('chat stores an authenticated message and returns it', (t) => {
  const auth = { name: 'user', password: 'pwd' };
  const addRes = fakeRes();
  routes.chat.add({ body: { auth, message: { text: 'hello' } } }, addRes);
  t.same(addRes.body, { ok: true });

  const getRes = fakeRes();
  routes.chat.get({}, getRes);
  const stored = getRes.body[getRes.body.length - 1];
  t.equal(stored.text, 'hello');
  t.equal(stored.userName, 'user');
  t.equal(stored.icon, '\u{1F44B}', 'default icon is applied');
  t.end();
});
