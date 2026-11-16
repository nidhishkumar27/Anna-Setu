// tests/receiver.test.js — Tests for /api/receiver routes
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const { connect, closeDatabase, clearDatabase } = require('./setup');
const User = require('../models/User');

let receiverToken;
let receiverId;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-key';
  await connect();
});

afterAll(async () => {
  await closeDatabase();
});

beforeEach(async () => {
  await clearDatabase();

  // Create a receiver directly (status: approved) so we can log in
  const receiver = new User({
    name: 'Test Receiver',
    email: 'receiver@test.com',
    password: 'password123',
    role: 'receiver',
    status: 'approved',
  });
  await receiver.save();
  receiverId = receiver._id.toString();

  const login = await request(app).post('/api/auth/login').send({
    email: 'receiver@test.com',
    password: 'password123',
  });
  receiverToken = login.body.token;
});

// ─── Food Requests ────────────────────────────────────────────────────────────

describe('POST /api/receiver/requests', () => {
  test('creates a food request successfully', async () => {
    const res = await request(app)
      .post('/api/receiver/requests')
      .set('Authorization', `Bearer ${receiverToken}`)
      .send({ details: 'Need 20 kg of rice urgently.' });

    expect(res.statusCode).toBe(201);
    expect(res.body.request).toMatchObject({
      details: 'Need 20 kg of rice urgently.',
      status: 'Open',
    });
  });

  test('rejects unauthenticated request with 401', async () => {
    const res = await request(app)
      .post('/api/receiver/requests')
      .send({ details: 'Need food.' });
    expect(res.statusCode).toBe(401);
  });

  test('blocks a non-receiver role (403)', async () => {
    // Register an instant donor and try to access receiver route
    await request(app).post('/api/auth/register').send({
      name: 'Donor',
      email: 'donor@test.com',
      password: 'password123',
      role: 'donor',
      donorType: 'instant',
    });
    const donorLogin = await request(app).post('/api/auth/login').send({
      email: 'donor@test.com',
      password: 'password123',
    });
    const donorToken = donorLogin.body.token;

    const res = await request(app)
      .post('/api/receiver/requests')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ details: 'Need food.' });

    expect(res.statusCode).toBe(403);
  });
});

describe('GET /api/receiver/requests', () => {
  test('returns list of receiver\'s own requests', async () => {
    await request(app)
      .post('/api/receiver/requests')
      .set('Authorization', `Bearer ${receiverToken}`)
      .send({ details: 'Request 1' });
    await request(app)
      .post('/api/receiver/requests')
      .set('Authorization', `Bearer ${receiverToken}`)
      .send({ details: 'Request 2' });

    const res = await request(app)
      .get('/api/receiver/requests')
      .set('Authorization', `Bearer ${receiverToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  test('returns empty array when no requests exist', async () => {
    const res = await request(app)
      .get('/api/receiver/requests')
      .set('Authorization', `Bearer ${receiverToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─── Upcoming Deliveries ──────────────────────────────────────────────────────

describe('GET /api/receiver/deliveries/upcoming', () => {
  test('returns empty array when no tasks assigned', async () => {
    const res = await request(app)
      .get('/api/receiver/deliveries/upcoming')
      .set('Authorization', `Bearer ${receiverToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─── Delivery History ─────────────────────────────────────────────────────────

describe('GET /api/receiver/deliveries/history', () => {
  test('returns empty array when no completed deliveries', async () => {
    const res = await request(app)
      .get('/api/receiver/deliveries/history')
      .set('Authorization', `Bearer ${receiverToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });
});
