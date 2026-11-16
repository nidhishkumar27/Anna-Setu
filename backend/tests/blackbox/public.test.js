const request = require('supertest');
const app = require('../../app');

describe('Black-box public routes', () => {
  test('GET / returns the public welcome payload', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body).toEqual({ message: 'Welcome to the Anna Setu API!' });
  });

  test('unknown route returns a not-found response', async () => {
    const response = await request(app).get('/api/not-a-real-route');
    expect(response.status).toBe(404);
  });
});
