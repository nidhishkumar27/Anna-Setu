const request = require('supertest');
const app = require('../../app');
const { connect, closeDatabase, clearDatabase } = require('../setup');

beforeAll(connect);
afterAll(closeDatabase);
afterEach(clearDatabase);

describe('Black-box public registration roles', () => {
  test.each(['donor', 'receiver', 'volunteer'])('allows public registration as %s', async role => {
    const response = await request(app).post('/api/auth/register').send({
      name: `Self-register ${role}`,
      email: `self-register-${role}@example.com`,
      password: 'password123',
      role,
      ...(role === 'donor' ? { donorType: 'instant' } : {}),
    });

    expect(response.status).toBe(201);
    expect(response.body.message).toMatch(/registered successfully/i);
  });

  test.each(['admin', 'unknown-role'])('rejects public registration with role "%s"', async role => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Disallowed Role',
      email: `disallowed-${role}@example.com`,
      password: 'password123',
      role,
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/invalid role/i);
  });

  test('omitting role preserves the existing required-role validation behavior', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Role Omitted',
      email: 'role-omitted@example.com',
      password: 'password123',
    });

    // The current User schema requires role and defines no default; registration exposes
    // the existing Mongoose validation failure as HTTP 500.
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message');
  });
});
