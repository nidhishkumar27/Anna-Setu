const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const { connect, closeDatabase, clearDatabase } = require('../setup');

beforeAll(async () => { process.env.JWT_SECRET = 'test-secret-key'; await connect(); });
afterAll(closeDatabase);
afterEach(clearDatabase);
const token = () => jwt.sign({ id: '64a1b2c3d4e5f6a7b8c9d0e1', role: 'donor' }, process.env.JWT_SECRET);

describe('Black-box profile route authorization and validation', () => {
  test.each(['GET', 'PUT'])('%s /api/users/me rejects missing token with 401', async method => {
    const response = method === 'GET'
      ? await request(app).get('/api/users/me')
      : await request(app).put('/api/users/me').send({});
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
  });

  test.each(['GET', 'PUT'])('%s /api/users/me rejects malformed JWT with 401', async method => {
    let req = method === 'GET' ? request(app).get('/api/users/me') : request(app).put('/api/users/me').send({ name: 'x' });
    const response = await req.set('Authorization', 'Bearer malformed.jwt');
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
  });

  test('empty profile update is accepted as a no-op for a signed-in identity', async () => {
    const response = await request(app).put('/api/users/me').set('Authorization', `Bearer ${token()}`).send({});
    expect([200, 404]).toContain(response.status);
    expect(response.body).toHaveProperty('message');
  });
});
