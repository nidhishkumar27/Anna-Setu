// tests/user.test.js — Tests for GET/PUT /api/users/me
const request = require('supertest');
const app = require('../app');
const { connect, closeDatabase, clearDatabase } = require('./setup');

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

  // Register an instant donor (auto-approved) and log in
  await request(app).post('/api/auth/register').send({
    name: 'Profile User',
    email: 'profile@test.com',
    password: 'password123',
    role: 'donor',
    donorType: 'instant',
  });
  const login = await request(app).post('/api/auth/login').send({
    email: 'profile@test.com',
    password: 'password123',
  });
  userToken = login.body.token;
});

// ─── Get Profile ──────────────────────────────────────────────────────────────

describe('GET /api/users/me', () => {
  test('returns the logged-in user profile without password', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ name: 'Profile User', email: 'profile@test.com', role: 'donor' });
    expect(res.body.password).toBeUndefined();
  });

  test('rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.statusCode).toBe(401);
  });

  test('rejects invalid token with 401', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.statusCode).toBe(401);
  });
});

// ─── Update Profile ───────────────────────────────────────────────────────────

describe('PUT /api/users/me', () => {
  test('updates name and phone', async () => {
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Updated Name', phone: '9876543210' });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.name).toBe('Updated Name');
    expect(res.body.user.phone).toBe('9876543210');
  });

  test('updates address fields', async () => {
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        address: {
          street: '42 MG Road',
          city: 'Pune',
          state: 'Maharashtra',
          zip: '411001',
        },
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.address).toMatchObject({
      street: '42 MG Road',
      city: 'Pune',
      state: 'Maharashtra',
      zip: '411001',
    });
  });

  test('partial update preserves existing fields', async () => {
    // First set a name
    await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'First Name', phone: '1111111111' });

    // Then update only phone
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ phone: '2222222222' });

    expect(res.statusCode).toBe(200);
    expect(res.body.user.name).toBe('First Name'); // unchanged
    expect(res.body.user.phone).toBe('2222222222'); // updated
  });

  test('rejects unauthenticated update with 401', async () => {
    const res = await request(app)
      .put('/api/users/me')
      .send({ name: 'Hacker' });
    expect(res.statusCode).toBe(401);
  });
});
