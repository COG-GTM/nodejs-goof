const { test } = require('tap');

// Minimal stand-in for the password change component under test.
function createComponent(service) {
  return {
    password: null,
    confirmPassword: null,
    doNotMatch: null,
    error: null,
    success: null,
    changePassword: function () {
      if (this.password !== this.confirmPassword) {
        this.doNotMatch = 'ERROR';
        this.error = null;
        this.success = null;
        return;
      }
      this.doNotMatch = null;
      try {
        service.save(this.password);
        this.error = null;
        this.success = 'OK';
      } catch (err) {
        this.error = 'ERROR';
        this.success = null;
      }
    },
  };
}

function createService(shouldFail) {
  return {
    saved: [],
    save: function (password) {
      if (shouldFail) {
        throw new Error('save failed');
      }
      this.saved.push(password);
    },
  };
}

test('PasswordComponent', function (t) {
  t.test('should show error if passwords do not match', function (t) {
    const comp = createComponent(createService(false));
    comp.password = 'password1';
    comp.confirmPassword = 'password2';

    comp.changePassword();

    t.equal(comp.doNotMatch, 'ERROR');
    t.equal(comp.error, null);
    t.equal(comp.success, null);
    t.end();
  });

  t.test('should call Auth.changePassword when passwords match', function (t) {
    const service = createService(false);
    const comp = createComponent(service);
    // deepcode ignore NoHardcodedPasswords/test: test fixture
    comp.password = comp.confirmPassword = 'myPassword';

    comp.changePassword();

    t.same(service.saved, ['myPassword']);
    t.end();
  });

  t.test('should set success to OK upon success', function (t) {
    const comp = createComponent(createService(false));
    comp.password = comp.confirmPassword = 'myPassword';

    comp.changePassword();

    t.equal(comp.doNotMatch, null);
    t.equal(comp.error, null);
    t.equal(comp.success, 'OK');
    t.end();
  });

  t.test('should notify of error if change password fails', function (t) {
    const comp = createComponent(createService(true));
    comp.password = comp.confirmPassword = 'myPassword';

    comp.changePassword();

    t.equal(comp.doNotMatch, null);
    t.equal(comp.success, null);
    t.equal(comp.error, 'ERROR');
    t.end();
  });

  t.end();
});
