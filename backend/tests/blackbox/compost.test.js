const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const { connect, closeDatabase, clearDatabase } = require('../setup');

beforeAll(async () => { process.env.JWT_SECRET = 'test-secret-key'; await connect(); });
afterAll(closeDatabase);
afterEach(clearDatabase);
const paths = [
  ['GET', '/api/compost/donations'], ['POST', '/api/compost/sales'], ['GET', '/api/compost/sales'],
];
const send = (method, path, token) => {
  let req = request(app)[method.toLowerCase()](path);
  if (token) req = req.set('Authorization', `Bearer ${token}`);
  if (method === 'POST') req = req.send({});
  return req;
};

describe('Black-box compost route authorization', () => {
  test.each(paths)('%s %s requires authentication', async (method, path) => {
    const response = await send(method, path);
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
  });
  test.each(paths)('%s %s rejects invalid JWTs', async (method, path) => {
    const response = await send(method, path, 'broken.token');
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
  });
  test.each(paths)('%s %s denies non-admin roles without exposing data', async (method, path) => {
    const token = jwt.sign({ id: '64a1b2c3d4e5f6a7b8c9d0e1', role: 'volunteer' }, process.env.JWT_SECRET);
    const response = await send(method, path, token);
    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message');
  });
});
