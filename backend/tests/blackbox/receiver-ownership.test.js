const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const Donation = require('../../models/Donation');
const Task = require('../../models/Task');
const { connect, closeDatabase, clearDatabase } = require('../setup');

let receiverAToken;
let receiverBToken;
let receiverAId;
let receiverBId;
let receiverATaskId;
let receiverADonationId;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-key';
  await connect();
});

afterAll(closeDatabase);
afterEach(clearDatabase);

beforeEach(async () => {
  const [receiverA, receiverB, donor, volunteer] = await User.create([
    { name: 'Receiver A', email: 'receiver-a-ownership@test.com', password: 'password123', role: 'receiver', status: 'approved' },
    { name: 'Receiver B', email: 'receiver-b-ownership@test.com', password: 'password123', role: 'receiver', status: 'approved' },
    { name: 'Delivery Donor', email: 'delivery-donor-ownership@test.com', password: 'password123', role: 'donor', status: 'approved' },
    { name: 'Delivery Volunteer', email: 'delivery-volunteer-ownership@test.com', password: 'password123', role: 'volunteer', status: 'approved' },
  ]);
  receiverAId = receiverA._id.toString();
  receiverBId = receiverB._id.toString();

  const [loginA, loginB] = await Promise.all([
    request(app).post('/api/auth/login').send({ email: 'receiver-a-ownership@test.com', password: 'password123' }),
    request(app).post('/api/auth/login').send({ email: 'receiver-b-ownership@test.com', password: 'password123' }),
  ]);
  receiverAToken = loginA.body.token;
  receiverBToken = loginB.body.token;

  const createDelivery = async (receiver, description, status) => {
    const donation = await Donation.create({
      donor: donor._id,
      type: 'human',
      description,
      quantity: 5,
      pickupAddress: 'Receiver test address',
      status: status === 'Completed' ? 'Completed' : 'Delivered',
    });
    const task = await Task.create({
      donation: donation._id,
      volunteer: volunteer._id,
      receiver: receiver._id,
      status,
    });
    return { donation, task };
  };

  const deliveryA = await createDelivery(receiverA, 'Receiver A confirm target', 'Delivered');
  receiverATaskId = deliveryA.task._id.toString();
  receiverADonationId = deliveryA.donation._id.toString();
  await createDelivery(receiverB, 'Receiver B upcoming delivery', 'Delivered');
  await createDelivery(receiverA, 'Receiver A completed history', 'Completed');
  await createDelivery(receiverB, 'Receiver B completed history', 'Completed');
});

describe('Black-box receiver delivery ownership isolation', () => {
  test('a receiver cannot confirm another receiver’s delivery and persisted states stay unchanged', async () => {
    const response = await request(app)
      .post(`/api/receiver/tasks/${receiverATaskId}/confirm`)
      .set('Authorization', `Bearer ${receiverBToken}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toMatch(/not found|not authorized/i);

    const [task, donation] = await Promise.all([
      Task.findById(receiverATaskId),
      Donation.findById(receiverADonationId),
    ]);
    expect(task.receiver.toString()).toBe(receiverAId);
    expect(task.status).toBe('Delivered');
    expect(donation.status).toBe('Delivered');
  });

  test('upcoming deliveries and completed history are isolated by receiver', async () => {
    const [upcomingA, upcomingB, historyA, historyB] = await Promise.all([
      request(app).get('/api/receiver/deliveries/upcoming').set('Authorization', `Bearer ${receiverAToken}`),
      request(app).get('/api/receiver/deliveries/upcoming').set('Authorization', `Bearer ${receiverBToken}`),
      request(app).get('/api/receiver/deliveries/history').set('Authorization', `Bearer ${receiverAToken}`),
      request(app).get('/api/receiver/deliveries/history').set('Authorization', `Bearer ${receiverBToken}`),
    ]);

    for (const response of [upcomingA, upcomingB, historyA, historyB]) {
      expect(response.status).toBe(200);
    }
    expect(upcomingA.body.map(task => task.receiver)).toContain(receiverAId);
    expect(upcomingB.body.map(task => task.receiver)).toContain(receiverBId);
    expect(upcomingA.body.every(task => task.receiver === receiverAId)).toBe(true);
    expect(upcomingB.body.every(task => task.receiver === receiverBId)).toBe(true);
    expect(historyA.body).toHaveLength(1);
    expect(historyB.body).toHaveLength(1);
    expect(historyA.body.every(task => task.receiver === receiverAId)).toBe(true);
    expect(historyB.body.every(task => task.receiver === receiverBId)).toBe(true);
  });
});
