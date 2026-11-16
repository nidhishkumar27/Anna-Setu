const request = require('supertest');
const app = require('../../app');
const { connect, closeDatabase, clearDatabase } = require('../setup');

beforeAll(connect);
afterAll(closeDatabase);
afterEach(clearDatabase);

describe('Black-box authentication input validation', () => {
  test.each([
    ['missing name', { email: 'x@example.com', password: 'password123', role: 'donor', donorType: 'instant' }],
    ['missing email', { name: 'X', password: 'password123', role: 'donor', donorType: 'instant' }],
    ['missing password', { name: 'X', email: 'x@example.com', role: 'donor', donorType: 'instant' }],
    ['missing role', { name: 'X', email: 'x@example.com', password: 'password123' }],
    ['empty body', {}],
  ])('registration with %s returns a client/server error and JSON error payload', async (_case, body) => {
    const response = await request(app).post('/api/auth/register').send(body);
    expect([400, 500]).toContain(response.status);
    expect(response.body).toHaveProperty('message');
  });

  test.each([
    ['missing email', { password: 'password123' }],
    ['missing password', { email: 'nobody@example.com' }],
    ['empty body', {}],
  ])('login with %s returns 401 and an error message', async (_case, body) => {
    const response = await request(app).post('/api/auth/login').send(body);
    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/invalid credentials/i);
  });

  test.each([
    ['missing regular donor license', { name: 'Regular', email: 'regular@example.com', password: 'password123', role: 'donor', donorType: 'regular' }],
    ['malformed regular donor license', { name: 'Regular', email: 'bad-license@example.com', password: 'password123', role: 'donor', donorType: 'regular', fssaiLicense: '123' }],
  ])('registration with %s returns 400', async (_case, body) => {
    const response = await request(app).post('/api/auth/register').send(body);
    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('message');
  });

  test('malformed JSON receives Express parser 400', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(response.status).toBe(400);
  });
});
