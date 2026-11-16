const User = require('../../../models/User');
const { runPreSaveMiddleware } = require('../helpers');

describe('User password authentication component', () => {
  test('hashes a modified password through the registered save middleware', async () => {
    const plainPassword = 'component-password-123';
    const user = new User({
      name: 'Password Component User',
      email: 'password-component@example.test',
      password: plainPassword,
      role: 'donor',
    });

    await runPreSaveMiddleware(User, user);

    expect(user.password).not.toBe(plainPassword);
    expect(user.password).toMatch(/^\$2[aby]\$10\$/);
    await expect(user.comparePassword(plainPassword)).resolves.toBe(true);
    await expect(user.comparePassword('incorrect-password')).resolves.toBe(false);
  });

  test('does not hash the password again when it is not modified', async () => {
    const user = new User({
      name: 'Password Component User',
      email: 'password-component@example.test',
      password: 'already-hashed-placeholder',
      role: 'donor',
    });
    user.$isNew = false;
    user.$__.activePaths.clear('modify');

    await runPreSaveMiddleware(User, user);

    expect(user.password).toBe('already-hashed-placeholder');
  });
});
