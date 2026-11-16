const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const Donation = require('../../models/Donation');
const Task = require('../../models/Task');
const { connect, closeDatabase, clearDatabase } = require('../setup');

let volunteerToken;
let volunteer;
let donor;
let receiver;
let donation;
let task;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-key';
  await connect();
});
afterAll(closeDatabase);
afterEach(clearDatabase);

beforeEach(async () => {
  [volunteer, donor, receiver] = await User.create([
    { name: 'Transition Volunteer', email: 'transition-volunteer@test.com', password: 'password123', role: 'volunteer', status: 'approved' },
    { name: 'Transition Donor', email: 'transition-donor@test.com', password: 'password123', role: 'donor', status: 'approved' },
    { name: 'Transition Receiver', email: 'transition-receiver@test.com', password: 'password123', role: 'receiver', status: 'approved' },
  ]);
  const login = await request(app).post('/api/auth/login').send({ email: volunteer.email, password: 'password123' });
  volunteerToken = login.body.token;
  donation = await Donation.create({
    donor: donor._id,
    type: 'human',
    description: 'Volunteer transition donation',
    quantity: 10,
    pickupAddress: 'Transition road',
    status: 'Assigned',
  });
  task = await Task.create({ donation: donation._id, volunteer: volunteer._id, receiver: receiver._id });
});

const update = (status, qualityCheck) => request(app)
  .patch(`/api/volunteer/tasks/${task._id}/status`)
  .set('Authorization', `Bearer ${volunteerToken}`)
  .send(status === undefined ? {} : { status, ...(qualityCheck ? { qualityCheck } : {}) });

describe('Black-box volunteer task status transitions', () => {
  test('Accepted persists task state without changing donation state', async () => {
    const response = await update('Accepted');
    expect(response.status).toBe(200);
    expect((await Task.findById(task._id)).status).toBe('Accepted');
    expect((await Donation.findById(donation._id)).status).toBe('Assigned');
  });

  test('Picked Up persists task and related donation state', async () => {
    const response = await update('Picked Up', { foodQuality: 'Good', packaging: 'Good' });
    expect(response.status).toBe(200);
    expect((await Task.findById(task._id)).status).toBe('Picked Up');
    expect((await Donation.findById(donation._id)).status).toBe('Picked Up');
  });

  test('Delivered persists task and related donation state', async () => {
    const response = await update('Delivered');
    expect(response.status).toBe(200);
    expect((await Task.findById(task._id)).status).toBe('Delivered');
    expect((await Donation.findById(donation._id)).status).toBe('Delivered');
  });

  test('missing status currently succeeds as a no-op and leaves persisted states unchanged', async () => {
    const response = await update(undefined);
    expect(response.status).toBe(200);
    expect((await Task.findById(task._id)).status).toBe('Pending Acceptance');
    expect((await Donation.findById(donation._id)).status).toBe('Assigned');
  });

  test('invalid status is rejected by enum validation and leaves task unchanged', async () => {
    const response = await update('Teleporting');
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message');
    expect((await Task.findById(task._id)).status).toBe('Pending Acceptance');
    expect((await Donation.findById(donation._id)).status).toBe('Assigned');
  });

  test('repeating the same valid status is accepted and remains persisted', async () => {
    expect((await update('Accepted')).status).toBe(200);
    expect((await update('Accepted')).status).toBe(200);
    expect((await Task.findById(task._id)).status).toBe('Accepted');
  });

  test('out-of-order enum-valid update is currently permitted and can leave task and donation inconsistent', async () => {
    expect((await update('Delivered')).status).toBe(200);
    expect((await update('Accepted')).status).toBe(200);

    expect((await Task.findById(task._id)).status).toBe('Accepted');
    expect((await Donation.findById(donation._id)).status).toBe('Delivered');
  });
});
