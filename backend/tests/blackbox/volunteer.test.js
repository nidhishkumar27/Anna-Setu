const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const { connect, closeDatabase, clearDatabase } = require('../setup');

beforeAll(async () => { process.env.JWT_SECRET = 'test-secret-key'; await connect(); });
afterAll(closeDatabase);
afterEach(clearDatabase);
const paths = [['GET', '/api/volunteer/stats'], ['GET', '/api/volunteer/tasks'], ['PATCH', '/api/volunteer/tasks/64a1b2c3d4e5f6a7b8c9d0e1/status']];
const send = (method, path, token) => {
  let req = request(app)[method.toLowerCase()](path);
  if (token) req = req.set('Authorization', `Bearer ${token}`);
  if (method === 'PATCH') req = req.send({});
  return req;
};

describe('Black-box volunteer route authorization and input', () => {
  test.each(paths)('%s %s rejects missing token with 401', async (method, path) => {
    const response = await send(method, path);
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
  });
  test.each(paths)('%s %s rejects malformed token with 401', async (method, path) => {
    const response = await send(method, path, 'malformed-token');
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
  });
  test.each(paths)('%s %s denies another role with 403', async (method, path) => {
    const token = jwt.sign({ id: '64a1b2c3d4e5f6a7b8c9d0e1', role: 'donor' }, process.env.JWT_SECRET);
    const response = await send(method, path, token);
    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message');
  });
  test('invalid task ID with volunteer role has the controller error response', async () => {
    const token = jwt.sign({ id: '64a1b2c3d4e5f6a7b8c9d0e1', role: 'volunteer' }, process.env.JWT_SECRET);
    const response = await request(app).patch('/api/volunteer/tasks/not-an-id/status').set('Authorization', `Bearer ${token}`).send({ status: 'Accepted' });
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message');
  });
});
