const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const { connect, closeDatabase, clearDatabase } = require('../setup');

beforeAll(async () => { process.env.JWT_SECRET = 'test-secret-key'; await connect(); });
afterAll(closeDatabase);
afterEach(clearDatabase);
const paths = [
  ['GET', '/api/admin/stats'], ['GET', '/api/admin/activity'], ['GET', '/api/admin/pending-users'],
  ['GET', '/api/admin/users'], ['POST', '/api/admin/users/64a1b2c3d4e5f6a7b8c9d0e1/approve'],
  ['POST', '/api/admin/users/64a1b2c3d4e5f6a7b8c9d0e1/reject'], ['GET', '/api/admin/pending-donations'],
  ['POST', '/api/admin/assign-task'], ['GET', '/api/admin/tasks'], ['GET', '/api/admin/requests'],
  ['POST', '/api/admin/requests/64a1b2c3d4e5f6a7b8c9d0e1/fulfill'],
  ['GET', '/api/admin/compost/donations'], ['POST', '/api/admin/compost/sales'], ['GET', '/api/admin/compost/sales'],
];
const send = (method, path, token) => {
  let req = request(app)[method.toLowerCase()](path);
  if (token) req = req.set('Authorization', `Bearer ${token}`);
  if (method === 'POST') req = req.send({});
  return req;
};

describe('Black-box admin route authorization', () => {
  test.each(paths)('%s %s rejects missing token with 401', async (method, path) => {
    const response = await send(method, path);
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
  });

  test.each(paths)('%s %s rejects malformed token with 401', async (method, path) => {
    const response = await send(method, path, 'invalid.token.value');
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
  });

  test.each(paths)('%s %s rejects valid non-admin token with 403 and no protected data', async (method, path) => {
    const token = jwt.sign({ id: '64a1b2c3d4e5f6a7b8c9d0e1', role: 'donor' }, process.env.JWT_SECRET);
    const response = await send(method, path, token);
    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message');
  });

  test('invalid user ID reaches the controller error contract', async () => {
    const token = jwt.sign({ id: '64a1b2c3d4e5f6a7b8c9d0e1', role: 'admin' }, process.env.JWT_SECRET);
    const response = await request(app).post('/api/admin/users/not-an-id/approve').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message');
  });
});
