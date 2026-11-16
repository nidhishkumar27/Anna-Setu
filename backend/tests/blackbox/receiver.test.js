const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const { connect, closeDatabase, clearDatabase } = require('../setup');

beforeAll(async () => { process.env.JWT_SECRET = 'test-secret-key'; await connect(); });
afterAll(closeDatabase);
afterEach(clearDatabase);
const paths = [
  ['POST', '/api/receiver/requests'], ['GET', '/api/receiver/requests'],
  ['GET', '/api/receiver/deliveries/upcoming'], ['POST', '/api/receiver/tasks/64a1b2c3d4e5f6a7b8c9d0e1/confirm'],
  ['GET', '/api/receiver/deliveries/history'],
];
const send = (method, path, token) => {
  let req = request(app)[method.toLowerCase()](path);
  if (token) req = req.set('Authorization', `Bearer ${token}`);
  if (method === 'POST') req = req.send({});
  return req;
};

describe('Black-box receiver route authorization and input', () => {
  test.each(paths)('%s %s rejects missing token with 401', async (method, path) => {
    const response = await send(method, path);
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
  });
  test.each(paths)('%s %s rejects malformed token with 401', async (method, path) => {
    const response = await send(method, path, 'not.a.valid.jwt');
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
  });
  test.each(paths)('%s %s denies a donor token with 403 and no protected data', async (method, path) => {
    const token = jwt.sign({ id: '64a1b2c3d4e5f6a7b8c9d0e1', role: 'donor' }, process.env.JWT_SECRET);
    const response = await send(method, path, token);
    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message');
  });
  test('empty request body reaches required-field validation', async () => {
    const token = jwt.sign({ id: '64a1b2c3d4e5f6a7b8c9d0e1', role: 'receiver' }, process.env.JWT_SECRET);
    const response = await request(app).post('/api/receiver/requests').set('Authorization', `Bearer ${token}`).send({});
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message');
  });
});
