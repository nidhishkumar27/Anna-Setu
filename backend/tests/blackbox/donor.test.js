const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const { connect, closeDatabase, clearDatabase } = require('../setup');

beforeAll(async () => { process.env.JWT_SECRET = 'test-secret-key'; await connect(); });
afterAll(closeDatabase);
afterEach(clearDatabase);
const tokenFor = role => jwt.sign({ id: '64a1b2c3d4e5f6a7b8c9d0e1', role }, process.env.JWT_SECRET);

describe('Black-box donor route guards and validation', () => {
  test.each(['POST', 'GET'])('%s /api/donor rejects missing credentials with 401 JSON', async method => {
    const response = method === 'POST'
      ? await request(app).post('/api/donor').send({})
      : await request(app).get('/api/donor');
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
  });

  test.each(['not-a-jwt', 'Bearer', 'Basic abc.def.ghi'])('rejects malformed authorization header %s', async auth => {
    const response = await request(app).get('/api/donor').set('Authorization', auth);
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
  });

  test('valid non-donor token can access donor endpoints because route has authentication only', async () => {
    const response = await request(app).get('/api/donor').set('Authorization', `Bearer ${tokenFor('receiver')}`);
    expect(response.status).not.toBe(401);
  });

  test('empty donation body fails with observable server error JSON', async () => {
    const response = await request(app).post('/api/donor').set('Authorization', `Bearer ${tokenFor('donor')}`).send({});
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message');
  });
});
