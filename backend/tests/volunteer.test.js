// tests/volunteer.test.js — Tests for /api/volunteer routes
const request = require('supertest');
const app = require('../app');
const { connect, closeDatabase, clearDatabase } = require('./setup');
const User = require('../models/User');
const Donation = require('../models/Donation');
const Task = require('../models/Task');

let volunteerToken;
let volunteerId;
let donorId;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-key';
  await connect();
});

afterAll(async () => {
  await closeDatabase();
});

beforeEach(async () => {
  await clearDatabase();

  // Create an approved volunteer
  const volunteer = new User({
    name: 'Test Volunteer',
    email: 'volunteer@test.com',
    password: 'password123',
    role: 'volunteer',
    status: 'approved',
  });
  await volunteer.save();
  volunteerId = volunteer._id;

  // Create an approved donor (for creating donations)
  const donor = new User({
    name: 'Test Donor',
    email: 'donor@test.com',
    password: 'password123',
    role: 'donor',
    status: 'approved',
  });
  await donor.save();
  donorId = donor._id;

  const login = await request(app).post('/api/auth/login').send({
    email: 'volunteer@test.com',
    password: 'password123',
  });
  volunteerToken = login.body.token;
});

// ─── Stats ────────────────────────────────────────────────────────────────────

describe('GET /api/volunteer/stats', () => {
  test('returns zero stats when no tasks assigned', async () => {
    const res = await request(app)
      .get('/api/volunteer/stats')
      .set('Authorization', `Bearer ${volunteerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      tasksCompleted: 0,
      activeTasks: 0,
      mealsServed: 0,
    });
  });

  test('returns correct stats with assigned tasks', async () => {
    const donation = new Donation({
      donor: donorId,
      type: 'human',
      description: 'Test food',
      quantity: 10,
      pickupAddress: '123 Street',
    });
    await donation.save();

    const receiver = new User({
      name: 'Recv',
      email: 'recv@test.com',
      password: 'password123',
      role: 'receiver',
      status: 'approved',
    });
    await receiver.save();

    await Task.create({
      donation: donation._id,
      volunteer: volunteerId,
      receiver: receiver._id,
      status: 'Accepted',
    });

    const res = await request(app)
      .get('/api/volunteer/stats')
      .set('Authorization', `Bearer ${volunteerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.activeTasks).toBe(1);
  });

  test('rejects unauthenticated request with 401', async () => {
    const res = await request(app).get('/api/volunteer/stats');
    expect(res.statusCode).toBe(401);
  });

  test('blocks non-volunteer role with 403', async () => {
    // Create an instant donor and try to access volunteer route
    await request(app).post('/api/auth/register').send({
      name: 'Donor2',
      email: 'donor2@test.com',
      password: 'password123',
      role: 'donor',
      donorType: 'instant',
    });
    const donorLogin = await request(app).post('/api/auth/login').send({
      email: 'donor2@test.com',
      password: 'password123',
    });

    const res = await request(app)
      .get('/api/volunteer/stats')
      .set('Authorization', `Bearer ${donorLogin.body.token}`);

    expect(res.statusCode).toBe(403);
  });
});

// ─── Assigned Tasks ───────────────────────────────────────────────────────────

describe('GET /api/volunteer/tasks', () => {
  test('returns empty array when no tasks assigned', async () => {
    const res = await request(app)
      .get('/api/volunteer/tasks')
      .set('Authorization', `Bearer ${volunteerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns tasks assigned to this volunteer', async () => {
    const donation = new Donation({
      donor: donorId,
      type: 'human',
      description: 'Test food',
      quantity: 8,
      pickupAddress: '456 Lane',
    });
    await donation.save();

    const receiver = new User({
      name: 'Recv2',
      email: 'recv2@test.com',
      password: 'password123',
      role: 'receiver',
      status: 'approved',
    });
    await receiver.save();

    await Task.create({
      donation: donation._id,
      volunteer: volunteerId,
      receiver: receiver._id,
    });

    const res = await request(app)
      .get('/api/volunteer/tasks')
      .set('Authorization', `Bearer ${volunteerToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe('Pending Acceptance');
  });
});

// ─── Update Task Status ───────────────────────────────────────────────────────

describe('PATCH /api/volunteer/tasks/:id/status', () => {
  let taskId;

  beforeEach(async () => {
    const donation = new Donation({
      donor: donorId,
      type: 'human',
      description: 'Test food',
      quantity: 5,
      pickupAddress: '789 Road',
    });
    await donation.save();

    const receiver = new User({
      name: 'Recv3',
      email: 'recv3@test.com',
      password: 'password123',
      role: 'receiver',
      status: 'approved',
    });
    await receiver.save();

    const task = await Task.create({
      donation: donation._id,
      volunteer: volunteerId,
      receiver: receiver._id,
    });
    taskId = task._id.toString();
  });

  test('updates task status to Accepted', async () => {
    const res = await request(app)
      .patch(`/api/volunteer/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${volunteerToken}`)
      .send({ status: 'Accepted' });

    expect(res.statusCode).toBe(200);
    expect(res.body.task.status).toBe('Accepted');
  });

  test('updates task status to Picked Up with quality check', async () => {
    const res = await request(app)
      .patch(`/api/volunteer/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${volunteerToken}`)
      .send({
        status: 'Picked Up',
        qualityCheck: { foodQuality: 'Good', packaging: 'Good', remarks: 'Looks fresh' },
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.task.status).toBe('Picked Up');
    expect(res.body.task.qualityCheck.foodQuality).toBe('Good');
  });

  test('returns 404 for a task not belonging to this volunteer', async () => {
    const fakeId = '64a1b2c3d4e5f6a7b8c9d0e1'; // valid ObjectId, wrong task
    const res = await request(app)
      .patch(`/api/volunteer/tasks/${fakeId}/status`)
      .set('Authorization', `Bearer ${volunteerToken}`)
      .send({ status: 'Accepted' });

    expect(res.statusCode).toBe(404);
  });
});
