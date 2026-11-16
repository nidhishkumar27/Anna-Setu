const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const User = require('../../models/User');
const Donation = require('../../models/Donation');
const Task = require('../../models/Task');
const { connect, closeDatabase, clearDatabase } = require('../setup');

let adminToken;
let donor;
let volunteer;
let receiver;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-key';
  await connect();
});
afterAll(closeDatabase);
afterEach(clearDatabase);

beforeEach(async () => {
  const admin = await User.create({ name: 'Admin', email: 'assign-admin@test.com', password: 'password123', role: 'admin', status: 'approved' });
  donor = await User.create({ name: 'Donor', email: 'assign-donor@test.com', password: 'password123', role: 'donor', status: 'approved' });
  volunteer = await User.create({ name: 'Volunteer', email: 'assign-volunteer@test.com', password: 'password123', role: 'volunteer', status: 'approved' });
  receiver = await User.create({ name: 'Receiver', email: 'assign-receiver@test.com', password: 'password123', role: 'receiver', status: 'approved' });
  const login = await request(app).post('/api/auth/login').send({ email: admin.email, password: 'password123' });
  adminToken = login.body.token;
});

const pendingDonation = () => Donation.create({
  donor: donor._id,
  type: 'human',
  description: 'Assignment persistence donation',
  quantity: 8,
  pickupAddress: 'Assignment street',
  status: 'Pending',
});

const assign = (donationId, volunteerId = volunteer._id, receiverId = receiver._id) => request(app)
  .post('/api/admin/assign-task')
  .set('Authorization', `Bearer ${adminToken}`)
  .send({ donationId: String(donationId), volunteerId: String(volunteerId), receiverId: String(receiverId) });

describe('Black-box donation assignment persistence', () => {
  test('assignment persists task references and donation links/status', async () => {
    const donation = await pendingDonation();
    const response = await assign(donation._id);

    expect(response.status).toBe(201);
    const task = await Task.findById(response.body.task._id);
    const savedDonation = await Donation.findById(donation._id);
    expect(task.donation.toString()).toBe(donation._id.toString());
    expect(task.volunteer.toString()).toBe(volunteer._id.toString());
    expect(task.receiver.toString()).toBe(receiver._id.toString());
    expect(task.status).toBe('Pending Acceptance');
    expect(savedDonation.status).toBe('Assigned');
    expect(savedDonation.assignedVolunteer.toString()).toBe(volunteer._id.toString());
    expect(savedDonation.currentTask.toString()).toBe(task._id.toString());
  });

  test.each([
    ['missing volunteer ID', id => assign(id, null, receiver._id)],
    ['missing receiver ID', id => assign(id, volunteer._id, null)],
  ])('%s returns the current model validation error and leaves donation pending', async (_label, requestFor) => {
    const donation = await pendingDonation();
    const response = await requestFor(donation._id);
    expect(response.status).toBe(500);
    expect(await Donation.countDocuments({ _id: donation._id, status: 'Pending' })).toBe(1);
    expect(await Task.countDocuments({ donation: donation._id })).toBe(0);
  });

  test.each([
    ['malformed volunteer ID', id => assign(id, 'bad-volunteer-id', receiver._id)],
    ['malformed receiver ID', id => assign(id, volunteer._id, 'bad-receiver-id')],
  ])('%s is rejected and leaves donation pending', async (_label, requestFor) => {
    const donation = await pendingDonation();
    const response = await requestFor(donation._id);
    expect(response.status).toBe(500);
    expect(await Donation.countDocuments({ _id: donation._id, status: 'Pending' })).toBe(1);
    expect(await Task.countDocuments({ donation: donation._id })).toBe(0);
  });

  test.each(['nonexistent volunteer', 'nonexistent receiver'])('%s reference is currently accepted by the API', async scenario => {
    const donation = await pendingDonation();
    const missingUserId = new mongoose.Types.ObjectId();
    const response = scenario === 'nonexistent volunteer'
      ? await assign(donation._id, missingUserId, receiver._id)
      : await assign(donation._id, volunteer._id, missingUserId);

    // The API currently validates ObjectId shape through Task but does not verify referenced users exist.
    expect(response.status).toBe(201);
    const task = await Task.findOne({ donation: donation._id });
    expect(task).toBeTruthy();
    expect(task[scenario === 'nonexistent volunteer' ? 'volunteer' : 'receiver'].toString()).toBe(missingUserId.toString());
    expect((await Donation.findById(donation._id)).status).toBe('Assigned');
  });

  test.each(['donor used as volunteer', 'volunteer used as receiver'])('%s role is not checked by the current assignment API', async scenario => {
    const donation = await pendingDonation();
    const response = scenario === 'donor used as volunteer'
      ? await assign(donation._id, donor._id, receiver._id)
      : await assign(donation._id, volunteer._id, volunteer._id);

    // Task only stores references; the controller does not validate the referenced users' roles.
    expect(response.status).toBe(201);
    expect(await Task.countDocuments({ donation: donation._id })).toBe(1);
  });

  test('a repeated assignment returns 404 and does not create a second task', async () => {
    const donation = await pendingDonation();
    const first = await assign(donation._id);
    const second = await assign(donation._id);

    expect(first.status).toBe(201);
    expect(second.status).toBe(404);
    expect(await Task.countDocuments({ donation: donation._id })).toBe(1);
  });
});
