const User = require('../../../models/User');

describe('User model component', () => {
  test('applies pending status, lowercases email, and trims string fields', () => {
    const user = new User({
      name: '  Component User  ',
      email: 'COMPONENT@EXAMPLE.TEST',
      password: 'password123',
      role: 'donor',
    });

    expect(user.status).toBe('pending');
    expect(user.name).toBe('Component User');
    expect(user.email).toBe('component@example.test');
    expect(user.validateSync()).toBeUndefined();
  });

  test('requires name, email, password, and role', () => {
    const error = new User({}).validateSync();

    expect(Object.keys(error.errors)).toEqual(expect.arrayContaining(['name', 'email', 'password', 'role']));
  });

  test('rejects unsupported role, status, and donor type values', () => {
    const error = new User({
      name: 'Component User',
      email: 'component@example.test',
      password: 'password123',
      role: 'unknown-role',
      status: 'unknown-status',
      donorType: 'unknown-donor-type',
    }).validateSync();

    expect(error.errors.role).toBeDefined();
    expect(error.errors.status).toBeDefined();
    expect(error.errors.donorType).toBeDefined();
  });
});
