var ADMIN_USERNAME = 'admin@snyk.io';
var ADMIN_PASSWORD = 'SuperSecretPassword';

// Creates the demo admin account when it is missing. Calls back with
// (err, created) where `created` tells whether a new account was saved.
function seedAdmin(UserModel, callback) {
  var done = callback || function () {};

  UserModel.find({ username: ADMIN_USERNAME }).exec(function (err, users) {
    if (err) {
      console.log('error looking up admin user');
      return done(err, false);
    }

    if (users && users.length > 0) {
      return done(null, false);
    }

    console.log('no admin');
    new UserModel({
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    }).save(function (saveErr) {
      if (saveErr) {
        console.log('error saving admin user');
        return done(saveErr, false);
      }
      done(null, true);
    });
  });
}

module.exports = {
  seedAdmin: seedAdmin,
  ADMIN_USERNAME: ADMIN_USERNAME,
};
