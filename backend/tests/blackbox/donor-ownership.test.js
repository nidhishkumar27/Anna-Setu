const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const Donation = require('../../models/Donation');
const { connect, closeDatabase, clearDatabase } = require('../setup');

let donorAToken;
let donorBToken;
let donorAId;
let donorBId;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-key';
  await connect();
});

afterAll(closeDatabase);
afterEach(clearDatabase);

beforeEach(async () => {
  const [donorA, donorB] = await User.create([
    { name: 'Donor A', email: 'donor-a-ownership@test.com', password: 'password123', role: 'donor', status: 'approved' },
    { name: 'Donor B', email: 'donor-b-ownership@test.com', password: 'password123', role: 'donor', status: 'approved' },
  ]);
  donorAId = donorA._id.toString();
  donorBId = donorB._id.toString();

  const [loginA, loginB] = await Promise.all([
    request(app).post('/api/auth/login').send({ email: 'donor-a-ownership@test.com', password: 'password123' }),
    request(app).post('/api/auth/login').send({ email: 'donor-b-ownership@test.com', password: 'password123' }),
  ]);
  donorAToken = loginA.body.token;
  donorBToken = loginB.body.token;
});

describe('Black-box donor record ownership isolation', () => {
  test('each donor history contains only that donor’s donations', async () => {
    const donationA = await request(app)
      .post('/api/donor')
      .set('Authorization', `Bearer ${donorAToken}`)
      .send({ type: 'human', description: 'Donor A food', quantity: 7, pickupAddress: 'A street' });
    const donationB = await request(app)
      .post('/api/donor')
      .set('Authorization', `Bearer ${donorBToken}`)
      .send({ type: 'animal', description: 'Donor B food', quantity: 9, pickupAddress: 'B street' });

    expect(donationA.status).toBe(201);
    expect(donationB.status).toBe(201);
    expect(donationA.body.donation.donor).toBe(donorAId);
    expect(donationB.body.donation.donor).toBe(donorBId);

    const [historyA, historyB] = await Promise.all([
      request(app).get('/api/donor').set('Authorization', `Bearer ${donorAToken}`),
      request(app).get('/api/donor').set('Authorization', `Bearer ${donorBToken}`),
    ]);

    expect(historyA.status).toBe(200);
    expect(historyB.status).toBe(200);
    expect(historyA.body.map(donation => donation.description)).toEqual(['Donor A food']);
    expect(historyB.body.map(donation => donation.description)).toEqual(['Donor B food']);

    const [savedA, savedB] = await Promise.all([
      Donation.findById(donationA.body.donation._id),
      Donation.findById(donationB.body.donation._id),
    ]);
    expect(savedA.donor.toString()).toBe(donorAId);
    expect(savedB.donor.toString()).toBe(donorBId);
  });
});
