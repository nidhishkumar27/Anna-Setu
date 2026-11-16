const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const Activity = require('../../models/Activity');
const { connect, closeDatabase, clearDatabase } = require('../setup');
const { registerAccount, login, createAdmin } = require('./helpers');

let adminToken;

beforeAll(async () => {
  process.env.JWT_SECRET = 'acceptance-test-secret';
  await connect();
});
afterAll(closeDatabase);
afterEach(clearDatabase);

describe('Admin account-management acceptance', () => {
  beforeEach(async () => {
    const admin = await createAdmin();
    expect(admin.loginResponse.status).toBe(200);
    adminToken = admin.token;
  });

  test('reviews pending accounts, approves a volunteer, rejects a receiver, and reflects dashboard activity', async () => {
    const volunteerRegistration = await registerAccount({ role: 'volunteer' });
    const receiverRegistration = await registerAccount({ role: 'receiver' });
    expect(volunteerRegistration.status).toBe(201);
    expect(receiverRegistration.status).toBe(201);

    const [volunteer, receiver] = await Promise.all([
      User.findOne({ role: 'volunteer' }),
      User.findOne({ role: 'receiver' }),
    ]);

    const pending = await request(app)
      .get('/api/admin/pending-users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(pending.status).toBe(200);
    expect(pending.body.map(user => user._id)).toEqual(expect.arrayContaining([
      volunteer._id.toString(),
      receiver._id.toString(),
    ]));

    const approved = await request(app)
      .post(`/api/admin/users/${volunteer._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    const rejected = await request(app)
      .post(`/api/admin/users/${receiver._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(approved.status).toBe(200);
    expect(rejected.status).toBe(200);

    expect((await User.findById(volunteer._id)).status).toBe('approved');
    expect((await User.findById(receiver._id)).status).toBe('rejected');
    expect(await Activity.countDocuments({ type: 'user_approved', userRef: volunteer._id })).toBe(1);
    expect(await Activity.countDocuments({ type: 'user_rejected' })).toBe(1);

    const [stats, activity] = await Promise.all([
      request(app).get('/api/admin/stats').set('Authorization', `Bearer ${adminToken}`),
      request(app).get('/api/admin/activity').set('Authorization', `Bearer ${adminToken}`),
    ]);
    expect(stats.status).toBe(200);
    expect(stats.body.activeVolunteers).toBe(1);
    expect(activity.status).toBe(200);
    expect(activity.body.map(item => item.type)).toEqual(expect.arrayContaining(['user_approved', 'user_rejected']));

    const approvedLogin = await login(volunteer.email);
    const rejectedLogin = await login(receiver.email);
    expect(approvedLogin.status).toBe(200);
    expect(rejectedLogin.status).toBe(403);
  });
});
