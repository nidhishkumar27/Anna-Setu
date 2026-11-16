const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const Activity = require('../../models/Activity');
const { connect, closeDatabase, clearDatabase } = require('../setup');

let adminToken;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-key';
  await connect();
});
afterAll(closeDatabase);
afterEach(clearDatabase);

beforeEach(async () => {
  await User.create({ name: 'Admin', email: 'admin-p2b@test.com', password: 'password123', role: 'admin', status: 'approved' });
  const login = await request(app).post('/api/auth/login').send({ email: 'admin-p2b@test.com', password: 'password123' });
  adminToken = login.body.token;
});

const createPendingUser = () => User.create({
  name: 'Pending Account',
  email: `pending-${Date.now()}-${Math.random()}@test.com`,
  password: 'password123',
  role: 'volunteer',
  status: 'pending',
});

describe('Black-box admin approval and rejection transitions', () => {
  test('approval persists and records an activity', async () => {
    const user = await createPendingUser();
    const response = await request(app).post(`/api/admin/users/${user._id}/approve`).set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect((await User.findById(user._id)).status).toBe('approved');
    expect(await Activity.countDocuments({ type: 'user_approved', userRef: user._id })).toBe(1);
  });

  test('rejection persists and records an activity', async () => {
    const user = await createPendingUser();
    const response = await request(app).post(`/api/admin/users/${user._id}/reject`).set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect((await User.findById(user._id)).status).toBe('rejected');
    expect(await Activity.countDocuments({ type: 'user_rejected' })).toBe(1);
  });

  test.each([
    ['approve', 'approve', 'approved', 'user_approved'],
    ['reject', 'reject', 'rejected', 'user_rejected'],
  ])('repeated %s action preserves status and records each action', async (firstAction, secondAction, status, activityType) => {
    const user = await createPendingUser();
    for (const action of [firstAction, secondAction]) {
      const response = await request(app).post(`/api/admin/users/${user._id}/${action}`).set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
    }
    expect((await User.findById(user._id)).status).toBe(status);
    expect(await Activity.countDocuments({ type: activityType })).toBe(2);
  });

  test('an approved account can subsequently be rejected and that state persists', async () => {
    const user = await createPendingUser();
    const approve = await request(app).post(`/api/admin/users/${user._id}/approve`).set('Authorization', `Bearer ${adminToken}`);
    const reject = await request(app).post(`/api/admin/users/${user._id}/reject`).set('Authorization', `Bearer ${adminToken}`);

    expect(approve.status).toBe(200);
    expect(reject.status).toBe(200);
    expect((await User.findById(user._id)).status).toBe('rejected');
    expect(await Activity.countDocuments({ userRef: user._id, type: 'user_approved' })).toBe(1);
    expect(await Activity.countDocuments({ type: 'user_rejected' })).toBe(1);
  });

  test('a rejected account can subsequently be approved and that state persists', async () => {
    const user = await createPendingUser();
    const reject = await request(app).post(`/api/admin/users/${user._id}/reject`).set('Authorization', `Bearer ${adminToken}`);
    const approve = await request(app).post(`/api/admin/users/${user._id}/approve`).set('Authorization', `Bearer ${adminToken}`);

    expect(reject.status).toBe(200);
    expect(approve.status).toBe(200);
    expect((await User.findById(user._id)).status).toBe('approved');
    expect(await Activity.countDocuments({ userRef: user._id, type: 'user_approved' })).toBe(1);
    expect(await Activity.countDocuments({ type: 'user_rejected' })).toBe(1);
  });
});
