// tests/admin.test.js — Tests for /api/admin routes
const request = require('supertest');
const app = require('../app');
const { connect, closeDatabase, clearDatabase } = require('./setup');
const User = require('../models/User');
const Donation = require('../models/Donation');

let adminToken;
let adminId;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-key';
  await connect();
});

afterAll(async () => {
  await closeDatabase();
});

beforeEach(async () => {
  await clearDatabase();

  // Create an admin user directly (admins are never self-registered via /register)
  const admin = new User({
    name: 'Admin User',
    email: 'admin@test.com',
    password: 'adminpass123',
    role: 'admin',
    status: 'approved',
  });
  await admin.save();
  adminId = admin._id;

  const login = await request(app).post('/api/auth/login').send({
    email: 'admin@test.com',
    password: 'adminpass123',
  });
  adminToken = login.body.token;
});

// ─── Auth Guard ───────────────────────────────────────────────────────────────

describe('Admin route auth guards', () => {
  test('blocks unauthenticated access with 401', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.statusCode).toBe(401);
  });

  test('blocks non-admin role with 403', async () => {
    // Instant donor — approved, but not admin
    await request(app).post('/api/auth/register').send({
      name: 'Donor',
      email: 'donor@test.com',
      password: 'password123',
      role: 'donor',
      donorType: 'instant',
    });
    const donorLogin = await request(app).post('/api/auth/login').send({
      email: 'donor@test.com',
      password: 'password123',
    });

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${donorLogin.body.token}`);

    expect(res.statusCode).toBe(403);
  });
});

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

describe('GET /api/admin/stats', () => {
  test('returns correct stats with empty DB (only admin present)', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      totalDonors: 0,
      totalReceivers: 0,
      activeVolunteers: 0,
      mealsServed: 0,
    });
  });

  test('counts pending approvals per role correctly', async () => {
    // Add 2 pending volunteers and 1 pending receiver
    await User.create([
      { name: 'V1', email: 'v1@test.com', password: 'password123', role: 'volunteer', status: 'pending' },
      { name: 'V2', email: 'v2@test.com', password: 'password123', role: 'volunteer', status: 'pending' },
      { name: 'R1', email: 'r1@test.com', password: 'password123', role: 'receiver', status: 'pending' },
    ]);

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.pendingVolunteers).toBe(2);
    expect(res.body.pendingReceivers).toBe(1);
  });
});

// ─── Pending Users ────────────────────────────────────────────────────────────

describe('GET /api/admin/pending-users', () => {
  test('returns only pending users', async () => {
    await User.create([
      { name: 'PendV', email: 'pv@test.com', password: 'password123', role: 'volunteer', status: 'pending' },
      { name: 'ApprD', email: 'ad@test.com', password: 'password123', role: 'donor', status: 'approved' },
    ]);

    const res = await request(app)
      .get('/api/admin/pending-users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('PendV');
    // password must not be exposed
    expect(res.body[0].password).toBeUndefined();
  });
});

// ─── Get All Users ────────────────────────────────────────────────────────────

describe('GET /api/admin/users', () => {
  test('returns all users (excluding password)', async () => {
    await User.create([
      { name: 'U1', email: 'u1@test.com', password: 'password123', role: 'donor', status: 'approved' },
      { name: 'U2', email: 'u2@test.com', password: 'password123', role: 'volunteer', status: 'pending' },
    ]);

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    // Admin itself + 2 new users = 3
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    res.body.forEach(u => expect(u.password).toBeUndefined());
  });

  test('filters users by role query param', async () => {
    await User.create([
      { name: 'Vol', email: 'vol@test.com', password: 'password123', role: 'volunteer', status: 'pending' },
      { name: 'Don', email: 'don@test.com', password: 'password123', role: 'donor', status: 'approved' },
    ]);

    const res = await request(app)
      .get('/api/admin/users?role=volunteer')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    res.body.forEach(u => expect(u.role).toBe('volunteer'));
  });
});

// ─── Approve / Reject User ────────────────────────────────────────────────────

describe('POST /api/admin/users/:id/approve', () => {
  test('approves a pending user', async () => {
    const user = await User.create({
      name: 'PendUser',
      email: 'pend@test.com',
      password: 'password123',
      role: 'volunteer',
      status: 'pending',
    });

    const res = await request(app)
      .post(`/api/admin/users/${user._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/approved/i);

    const updated = await User.findById(user._id);
    expect(updated.status).toBe('approved');
  });

  test('returns 404 for non-existent user', async () => {
    const fakeId = '64a1b2c3d4e5f6a7b8c9d0e1';
    const res = await request(app)
      .post(`/api/admin/users/${fakeId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(404);
  });
});

describe('POST /api/admin/users/:id/reject', () => {
  test('rejects a pending user', async () => {
    const user = await User.create({
      name: 'RejectMe',
      email: 'rej@test.com',
      password: 'password123',
      role: 'receiver',
      status: 'pending',
    });

    const res = await request(app)
      .post(`/api/admin/users/${user._id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/rejected/i);

    const updated = await User.findById(user._id);
    expect(updated.status).toBe('rejected');
  });
});

// ─── Pending Donations ────────────────────────────────────────────────────────

describe('GET /api/admin/pending-donations', () => {
  test('returns only Pending donations', async () => {
    const donor = await User.create({
      name: 'Donor',
      email: 'd@test.com',
      password: 'password123',
      role: 'donor',
      status: 'approved',
    });

    await Donation.create([
      { donor: donor._id, type: 'human', description: 'Food A', quantity: 5, pickupAddress: '1 St', status: 'Pending' },
      { donor: donor._id, type: 'human', description: 'Food B', quantity: 3, pickupAddress: '2 St', status: 'Assigned' },
    ]);

    const res = await request(app)
      .get('/api/admin/pending-donations')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].description).toBe('Food A');
  });
});

// ─── Assign Task ──────────────────────────────────────────────────────────────

describe('POST /api/admin/assign-task', () => {
  test('creates a task by assigning donation to volunteer and receiver', async () => {
    const donor = await User.create({
      name: 'Donor',
      email: 'd2@test.com',
      password: 'password123',
      role: 'donor',
      status: 'approved',
    });
    const volunteer = await User.create({
      name: 'Vol',
      email: 'vol2@test.com',
      password: 'password123',
      role: 'volunteer',
      status: 'approved',
    });
    const receiver = await User.create({
      name: 'Recv',
      email: 'recv@test.com',
      password: 'password123',
      role: 'receiver',
      status: 'approved',
    });
    const donation = await Donation.create({
      donor: donor._id,
      type: 'human',
      description: 'Assign me',
      quantity: 10,
      pickupAddress: '3 St',
      status: 'Pending',
    });

    const res = await request(app)
      .post('/api/admin/assign-task')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        donationId: donation._id.toString(),
        volunteerId: volunteer._id.toString(),
        receiverId: receiver._id.toString(),
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.task).toMatchObject({
      status: 'Pending Acceptance',
    });

    // Verify donation status updated
    const updatedDonation = await Donation.findById(donation._id);
    expect(updatedDonation.status).toBe('Assigned');
  });

  test('returns 404 when donation is already assigned', async () => {
    const donor = await User.create({
      name: 'Donor3',
      email: 'd3@test.com',
      password: 'password123',
      role: 'donor',
      status: 'approved',
    });
    const vol = await User.create({
      name: 'Vol3',
      email: 'vol3@test.com',
      password: 'password123',
      role: 'volunteer',
      status: 'approved',
    });
    const recv = await User.create({
      name: 'Recv3',
      email: 'recv3@test.com',
      password: 'password123',
      role: 'receiver',
      status: 'approved',
    });
    const donation = await Donation.create({
      donor: donor._id,
      type: 'human',
      description: 'Already assigned',
      quantity: 5,
      pickupAddress: '4 St',
      status: 'Assigned', // already assigned
    });

    const res = await request(app)
      .post('/api/admin/assign-task')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        donationId: donation._id.toString(),
        volunteerId: vol._id.toString(),
        receiverId: recv._id.toString(),
      });

    expect(res.statusCode).toBe(404);
  });
});

// ─── Open Requests ────────────────────────────────────────────────────────────

describe('GET /api/admin/requests', () => {
  test('returns only Open requests', async () => {
    const Request = require('../models/Request');
    const recv = await User.create({
      name: 'Recv4',
      email: 'recv4@test.com',
      password: 'password123',
      role: 'receiver',
      status: 'approved',
    });

    await Request.create([
      { receiver: recv._id, details: 'Open req', status: 'Open' },
      { receiver: recv._id, details: 'Fulfilled req', status: 'Fulfilled' },
    ]);

    const res = await request(app)
      .get('/api/admin/requests')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].details).toBe('Open req');
  });
});

// ─── Fulfill Request ──────────────────────────────────────────────────────────

describe('POST /api/admin/requests/:id/fulfill', () => {
  test('marks a request as Fulfilled', async () => {
    const Request = require('../models/Request');
    const recv = await User.create({
      name: 'Recv5',
      email: 'recv5@test.com',
      password: 'password123',
      role: 'receiver',
      status: 'approved',
    });
    const req = await Request.create({ receiver: recv._id, details: 'Fulfill me', status: 'Open' });

    const res = await request(app)
      .post(`/api/admin/requests/${req._id}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/fulfilled/i);

    const updated = await Request.findById(req._id);
    expect(updated.status).toBe('Fulfilled');
  });
});

// ─── Compost Sales ────────────────────────────────────────────────────────────

describe('POST /api/admin/compost/sales', () => {
  test('logs a compost sale', async () => {
    const res = await request(app)
      .post('/api/admin/compost/sales')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ buyerName: 'Green Farm', quantitySold: 50, revenue: 2500 });

    expect(res.statusCode).toBe(201);
    expect(res.body.sale).toMatchObject({ buyerName: 'Green Farm', quantitySold: 50, revenue: 2500 });
  });
});

describe('GET /api/admin/compost/sales', () => {
  test('returns all compost sales', async () => {
    const CompostSale = require('../models/CompostSale');
    await CompostSale.create([
      { buyerName: 'Farm A', quantitySold: 20, revenue: 1000 },
      { buyerName: 'Farm B', quantitySold: 30, revenue: 1500 },
    ]);

    const res = await request(app)
      .get('/api/admin/compost/sales')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});
