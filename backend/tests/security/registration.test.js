const request = require('supertest');
const app = require('../../app');
const { connect, closeDatabase, clearDatabase } = require('../setup');

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

describe('Registration security', () => {
  test.each(['donor', 'receiver', 'volunteer'])(
    'allows public registration as %s',
    async role => {
      const response = await request(app).post('/api/auth/register').send({
        name: `Security ${role}`,
        email: `security-${role}@example.com`,
        password: 'password123',
        role,
        ...(role === 'donor' ? { donorType: 'instant' } : {}),
      });

      expect(response.status).toBe(201);
      expect(response.body.message).toMatch(/registered successfully/i);
    },
  );

  test.each(['admin', 'unsupported-role'])(
    'rejects public registration with role %s',
    async role => {
      const response = await request(app).post('/api/auth/register').send({
        name: 'Disallowed Role',
        email: `security-${role}@example.com`,
        password: 'password123',
        role,
      });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/invalid role/i);
    },
  );
});
