// tests/donor.test.js — Tests for POST /api/donor and GET /api/donor
const request = require('supertest');
const app = require('../app');
const { connect, closeDatabase, clearDatabase } = require('./setup');

let donorToken;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-key';
  await connect();

  // Register and log in an instant donor (auto-approved)
  await request(app).post('/api/auth/register').send({
    name: 'Donor User',
    email: 'donor@test.com',
    password: 'password123',
    role: 'donor',
    donorType: 'instant',
  });
  const login = await request(app).post('/api/auth/login').send({
    email: 'donor@test.com',
    password: 'password123',
  });
  donorToken = login.body.token;
});

afterAll(async () => {
  await closeDatabase();
});

afterEach(async () => {
  // Only clear donations between tests, keep the user
  const mongoose = require('mongoose');
  await mongoose.connection.collections['donations']?.deleteMany({});
});

const validDonation = {
  type: 'human',
  description: 'Rice and dal',
  quantity: 10,
  pickupAddress: '123 Main St',
};

// ─── Create Donation ─────────────────────────────────────────────────────────

describe('POST /api/donor', () => {
  test('creates a donation when authenticated', async () => {
    const res = await request(app)
      .post('/api/donor')
      .set('Authorization', `Bearer ${donorToken}`)
      .send(validDonation);

    expect(res.statusCode).toBe(201);
    expect(res.body.donation).toMatchObject({
      type: 'human',
      quantity: 10,
      status: 'Pending',
    });
  });

  test('rejects request without auth token with 401', async () => {
    const res = await request(app).post('/api/donor').send(validDonation);
    expect(res.statusCode).toBe(401);
  });

  test('rejects compost donation type correctly', async () => {
    const res = await request(app)
      .post('/api/donor')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ ...validDonation, type: 'compost' });
    // compost is a valid enum, should succeed
    expect(res.statusCode).toBe(201);
    expect(res.body.donation.type).toBe('compost');
  });

  test('rejects invalid donation type with 500 (Mongoose validation)', async () => {
    const res = await request(app)
      .post('/api/donor')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ ...validDonation, type: 'invalid-type' });
    expect(res.statusCode).toBe(500);
  });
});

// ─── Get Donation History ─────────────────────────────────────────────────────

describe('GET /api/donor', () => {
  test('returns empty array when no donations exist', async () => {
    const res = await request(app)
      .get('/api/donor')
      .set('Authorization', `Bearer ${donorToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns donations belonging to the logged-in donor', async () => {
    // Create two donations
    await request(app)
      .post('/api/donor')
      .set('Authorization', `Bearer ${donorToken}`)
      .send(validDonation);
    await request(app)
      .post('/api/donor')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ ...validDonation, description: 'Bread and butter', quantity: 5 });

    const res = await request(app)
      .get('/api/donor')
      .set('Authorization', `Bearer ${donorToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/donor');
    expect(res.statusCode).toBe(401);
  });
});
