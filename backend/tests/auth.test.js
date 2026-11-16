
// tests/auth.test.js — Tests for POST /api/auth/register and POST /api/auth/login
const request = require('supertest');
const app = require('../app');
const { connect, closeDatabase, clearDatabase } = require('./setup');

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-key';
  await connect();
});

afterAll(async () => {
  await closeDatabase();
});

afterEach(async () => {
  await clearDatabase();
});

// ─── Registration ────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  test('registers a new instant donor and returns 201', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test Donor',
      email: 'donor@test.com',
      password: 'password123',
      role: 'donor',
      donorType: 'instant',
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.message).toMatch(/registered successfully/i);
  });

  test('registers a regular donor with pending status', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Regular Donor',
      email: 'regular@test.com',
      password: 'password123',
      role: 'donor',
      donorType: 'regular',
      fssaiLicense: '12345678901234',
    });
    expect(res.statusCode).toBe(201);
  });

  test('registers a volunteer with pending status', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test Volunteer',
      email: 'volunteer@test.com',
      password: 'password123',
      role: 'volunteer',
    });
    expect(res.statusCode).toBe(201);
  });

  test('rejects duplicate email with 400', async () => {
    const payload = {
      name: 'Dup User',
      email: 'dup@test.com',
      password: 'password123',
      role: 'donor',
      donorType: 'instant',
    };
    await request(app).post('/api/auth/register').send(payload);
    const res = await request(app).post('/api/auth/register').send(payload);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });
});

// ─── Login ───────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    // Seed an approved instant donor for login tests
    await request(app).post('/api/auth/register').send({
      name: 'Login Donor',
      email: 'login@test.com',
      password: 'password123',
      role: 'donor',
      donorType: 'instant',
    });
  });

  test('logs in an approved user and returns a JWT token', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@test.com',
      password: 'password123',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toMatchObject({ email: 'login@test.com', role: 'donor' });
  });

  test('rejects wrong password with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@test.com',
      password: 'wrongpassword',
    });
    expect(res.statusCode).toBe(401);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  test('rejects unknown email with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@test.com',
      password: 'password123',
    });
    expect(res.statusCode).toBe(401);
  });

  test('blocks a pending (non-approved) user with 403', async () => {
    // Regular donor is pending, not approved
    await request(app).post('/api/auth/register').send({
      name: 'Pending User',
      email: 'pending@test.com',
      password: 'password123',
      role: 'volunteer',
    });
    const res = await request(app).post('/api/auth/login').send({
      email: 'pending@test.com',
      password: 'password123',
    });
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toMatch(/pending approval/i);
  });
});
