const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const { connect, closeDatabase, clearDatabase } = require('../setup');

let userToken;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-key';
  await connect();
});

afterAll(async () => {
  await closeDatabase();
});

beforeEach(async () => {
  await clearDatabase();

  await request(app).post('/api/auth/register').send({
    name: 'Security Profile User',
    email: 'security-profile@example.com',
    password: 'password123',
    role: 'donor',
    donorType: 'instant',
  });

  const user = await User.findOne({ email: 'security-profile@example.com' });
  user.verificationDetails = {
    organizationName: 'Private Organization',
    contactPerson: 'Private Contact',
    licenseNumber: 'PRIVATE-LICENSE',
    fullAddress: 'Private Address',
  };
  await user.save();

  const login = await request(app).post('/api/auth/login').send({
    email: 'security-profile@example.com',
    password: 'password123',
  });
  userToken = login.body.token;
});

describe('User data security', () => {
  test('profile update succeeds and returns updated profile fields', async () => {
    const response = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Updated Security Profile', phone: '9876543210' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Profile updated successfully');
    expect(response.body.user).toMatchObject({
      name: 'Updated Security Profile',
      phone: '9876543210',
      email: 'security-profile@example.com',
    });
  });

  test('profile update response does not expose password or sensitive verification data', async () => {
    const response = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Updated Security Profile' });

    expect(response.status).toBe(200);
    expect(response.body.user).not.toHaveProperty('password');
    expect(response.body.user).not.toHaveProperty('passwordHash');
    expect(response.body.user).not.toHaveProperty('verificationDetails');
  });
});
