const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const Donation = require('../../models/Donation');
const Task = require('../../models/Task');
const { connect, closeDatabase, clearDatabase } = require('../setup');

let volunteerAToken;
let volunteerBToken;
let volunteerAId;
let volunteerBId;
let assignedTaskId;
let assignedDonationId;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-key';
  await connect();
});

afterAll(closeDatabase);
afterEach(clearDatabase);

beforeEach(async () => {
  const [volunteerA, volunteerB, donor, receiver] = await User.create([
    { name: 'Volunteer A', email: 'volunteer-a-ownership@test.com', password: 'password123', role: 'volunteer', status: 'approved' },
    { name: 'Volunteer B', email: 'volunteer-b-ownership@test.com', password: 'password123', role: 'volunteer', status: 'approved' },
    { name: 'Task Donor', email: 'task-donor-ownership@test.com', password: 'password123', role: 'donor', status: 'approved' },
    { name: 'Task Receiver', email: 'task-receiver-ownership@test.com', password: 'password123', role: 'receiver', status: 'approved' },
  ]);
  volunteerAId = volunteerA._id.toString();
  volunteerBId = volunteerB._id.toString();

  const [loginA, loginB] = await Promise.all([
    request(app).post('/api/auth/login').send({ email: 'volunteer-a-ownership@test.com', password: 'password123' }),
    request(app).post('/api/auth/login').send({ email: 'volunteer-b-ownership@test.com', password: 'password123' }),
  ]);
  volunteerAToken = loginA.body.token;
  volunteerBToken = loginB.body.token;

  const donation = await Donation.create({
    donor: donor._id,
    type: 'human',
    description: 'Volunteer isolation donation',
    quantity: 12,
    pickupAddress: 'Task pickup street',
    status: 'Assigned',
  });
  assignedDonationId = donation._id.toString();
  const task = await Task.create({
    donation: donation._id,
    volunteer: volunteerA._id,
    receiver: receiver._id,
    status: 'Pending Acceptance',
  });
  assignedTaskId = task._id.toString();
});

describe('Black-box volunteer task ownership isolation', () => {
  test('a volunteer cannot update another volunteer’s task and the records remain unchanged', async () => {
    const response = await request(app)
      .patch(`/api/volunteer/tasks/${assignedTaskId}/status`)
      .set('Authorization', `Bearer ${volunteerBToken}`)
      .send({ status: 'Accepted' });

    expect(response.status).toBe(404);
    expect(response.body.message).toMatch(/not found|not authorized/i);

    const [task, donation] = await Promise.all([
      Task.findById(assignedTaskId),
      Donation.findById(assignedDonationId),
    ]);
    expect(task.volunteer.toString()).toBe(volunteerAId);
    expect(task.status).toBe('Pending Acceptance');
    expect(donation.status).toBe('Assigned');
  });

  test('volunteer task lists expose only tasks assigned to the authenticated volunteer', async () => {
    const [listA, listB] = await Promise.all([
      request(app).get('/api/volunteer/tasks').set('Authorization', `Bearer ${volunteerAToken}`),
      request(app).get('/api/volunteer/tasks').set('Authorization', `Bearer ${volunteerBToken}`),
    ]);

    expect(listA.status).toBe(200);
    expect(listB.status).toBe(200);
    expect(listA.body.map(task => task._id)).toEqual([assignedTaskId]);
    expect(listB.body).toEqual([]);
    expect(listA.body[0].volunteer).toBe(volunteerAId);
  });
});
