const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const Donation = require('../../models/Donation');
const Task = require('../../models/Task');
const { connect, closeDatabase, clearDatabase } = require('../setup');

let receiverToken;
let receiver;
let donor;
let volunteer;
let donation;
let task;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-key';
  await connect();
});
afterAll(closeDatabase);
afterEach(clearDatabase);

beforeEach(async () => {
  [receiver, donor, volunteer] = await User.create([
    { name: 'Confirm Receiver', email: 'confirm-receiver@test.com', password: 'password123', role: 'receiver', status: 'approved' },
    { name: 'Confirm Donor', email: 'confirm-donor@test.com', password: 'password123', role: 'donor', status: 'approved' },
    { name: 'Confirm Volunteer', email: 'confirm-volunteer@test.com', password: 'password123', role: 'volunteer', status: 'approved' },
  ]);
  const login = await request(app).post('/api/auth/login').send({ email: receiver.email, password: 'password123' });
  receiverToken = login.body.token;
  donation = await Donation.create({
    donor: donor._id,
    type: 'human',
    description: 'Receiver confirmation donation',
    quantity: 10,
    pickupAddress: 'Confirmation lane',
    status: 'Delivered',
  });
  task = await Task.create({ donation: donation._id, volunteer: volunteer._id, receiver: receiver._id, status: 'Delivered' });
});

const confirm = () => request(app)
  .post(`/api/receiver/tasks/${task._id}/confirm`)
  .set('Authorization', `Bearer ${receiverToken}`);

describe('Black-box receiver delivery confirmation persistence', () => {
  test('successful confirmation completes task and donation and lists task in delivery history', async () => {
    const response = await confirm();
    expect(response.status).toBe(200);
    expect(response.body.message).toMatch(/receipt confirmed/i);
    expect((await Task.findById(task._id)).status).toBe('Completed');
    expect((await Donation.findById(donation._id)).status).toBe('Completed');

    const history = await request(app).get('/api/receiver/deliveries/history').set('Authorization', `Bearer ${receiverToken}`);
    expect(history.status).toBe(200);
    expect(history.body.map(item => item._id)).toContain(task._id.toString());
  });

  test('repeated confirmation remains successful and task remains completed', async () => {
    expect((await confirm()).status).toBe(200);
    expect((await confirm()).status).toBe(200);
    expect((await Task.findById(task._id)).status).toBe('Completed');
    expect((await Donation.findById(donation._id)).status).toBe('Completed');
  });

  test.each(['Pending Acceptance', 'Accepted', 'Picked Up', 'Delivered', 'Rejected'])('confirmation from initial task status "%s" is currently accepted', async initialStatus => {
    task.status = initialStatus;
    await task.save();

    const response = await confirm();
    expect(response.status).toBe(200);
    expect((await Task.findById(task._id)).status).toBe('Completed');
    expect((await Donation.findById(donation._id)).status).toBe('Completed');
  });

  test('confirmation updates volunteer completion statistics through completed task data', async () => {
    expect((await confirm()).status).toBe(200);
    const volunteerLogin = await request(app).post('/api/auth/login').send({ email: volunteer.email, password: 'password123' });
    const stats = await request(app).get('/api/volunteer/stats').set('Authorization', `Bearer ${volunteerLogin.body.token}`);

    expect(stats.status).toBe(200);
    expect(stats.body).toMatchObject({ tasksCompleted: 1, activeTasks: 0, mealsServed: 25 });
  });
});
