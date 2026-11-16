const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const { connect, closeDatabase, clearDatabase } = require('../setup');
const { TEST_PASSWORD, registerAccount, login } = require('./helpers');

beforeAll(async () => {
  process.env.JWT_SECRET = 'acceptance-test-secret';
  await connect();
});
afterAll(closeDatabase);
afterEach(clearDatabase);

describe('Account registration and authentication acceptance', () => {
  test.each(['donor', 'receiver', 'volunteer'])('registers a %s account', async role => {
    const response = await registerAccount({ role, donorType: role === 'donor' ? 'instant' : undefined });
    expect(response.status).toBe(201);

    const user = await User.findOne({ role, name: `Acceptance ${role}` });
    expect(user).not.toBeNull();
    expect(user.status).toBe(role === 'donor' ? 'approved' : 'pending');
  });

  test('rejects public admin registration and denies admin APIs to a donor', async () => {
    const rejected = await registerAccount({ role: 'admin' });
    expect(rejected.status).toBe(400);

    const registration = await registerAccount({ role: 'donor', donorType: 'instant' });
    expect(registration.status).toBe(201);
    const donor = await User.findOne({ role: 'donor' });
    const donorLogin = await login(donor.email);
    expect(donorLogin.status).toBe(200);

    const adminApi = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${donorLogin.body.token}`);
    expect(adminApi.status).toBe(403);
  });

  test('logs in an approved donor, reads and updates the authenticated profile', async () => {
    const registration = await registerAccount({ role: 'donor', donorType: 'instant' });
    expect(registration.status).toBe(201);
    const account = await User.findOne({ role: 'donor' });

    const authenticated = await login(account.email);
    expect(authenticated.status).toBe(200);
    expect(authenticated.body.user).toMatchObject({
      _id: account._id.toString(),
      email: account.email,
      role: 'donor',
    });
    expect(authenticated.body.token).toEqual(expect.any(String));

    const profile = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${authenticated.body.token}`);
    expect(profile.status).toBe(200);
    expect(profile.body).toMatchObject({ name: account.name, email: account.email, role: 'donor' });
    expect(profile.body).not.toHaveProperty('password');

    const update = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${authenticated.body.token}`)
      .send({ name: 'Acceptance Profile Updated', phone: '5550101234' });
    expect(update.status).toBe(200);
    expect(update.body.user).toMatchObject({ name: 'Acceptance Profile Updated', phone: '5550101234' });

    const persisted = await User.findById(account._id);
    expect(persisted.name).toBe('Acceptance Profile Updated');
    expect(persisted.phone).toBe('5550101234');
  });

  test('rejects incorrect and incomplete credentials and prevents pending-user login', async () => {
    const donorRegistration = await registerAccount({ role: 'donor', donorType: 'instant' });
    expect(donorRegistration.status).toBe(201);
    const donor = await User.findOne({ role: 'donor' });

    const incorrect = await login(donor.email, 'incorrect-password');
    expect(incorrect.status).toBe(401);
    const incomplete = await request(app).post('/api/auth/login').send({ email: donor.email });
    expect(incomplete.status).toBe(401);

    const pendingRegistration = await registerAccount({ role: 'volunteer' });
    expect(pendingRegistration.status).toBe(201);
    const volunteer = await User.findOne({ role: 'volunteer' });
    const pendingLogin = await login(volunteer.email);
    expect(pendingLogin.status).toBe(403);
    expect(pendingLogin.body.message).toMatch(/pending approval/i);
  });

  test('rejects missing and invalid tokens on a protected endpoint', async () => {
    const missing = await request(app).get('/api/users/me');
    expect(missing.status).toBe(401);

    const invalid = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer invalid.acceptance.token');
    expect(invalid.status).toBe(401);
  });
});
