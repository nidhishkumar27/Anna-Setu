const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const FoodRequest = require('../../models/Request');
const { connect, closeDatabase, clearDatabase } = require('../setup');
const { registerAccount, login, createAdmin } = require('./helpers');

let adminToken;

beforeAll(async () => {
  process.env.JWT_SECRET = 'acceptance-test-secret';
  await connect();
});
afterAll(closeDatabase);
afterEach(clearDatabase);

describe('Receiver request acceptance', () => {
  beforeEach(async () => {
    const admin = await createAdmin();
    expect(admin.loginResponse.status).toBe(200);
    adminToken = admin.token;
  });

  test('receiver submits a request, tracks it, and admin fulfills it', async () => {
    const registration = await registerAccount({ role: 'receiver' });
    expect(registration.status).toBe(201);
    const receiver = await User.findOne({ role: 'receiver' });

    const approval = await request(app)
      .post(`/api/admin/users/${receiver._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(approval.status).toBe(200);

    const receiverLogin = await login(receiver.email);
    expect(receiverLogin.status).toBe(200);
    const receiverToken = receiverLogin.body.token;

    const submitted = await request(app)
      .post('/api/receiver/requests')
      .set('Authorization', `Bearer ${receiverToken}`)
      .send({ details: 'Need 12 kilograms of rice for the shelter.' });
    expect(submitted.status).toBe(201);
    expect(submitted.body.request).toMatchObject({
      details: 'Need 12 kilograms of rice for the shelter.',
      status: 'Open',
      receiver: receiver._id.toString(),
    });

    const savedRequest = await FoodRequest.findById(submitted.body.request._id);
    expect(savedRequest).not.toBeNull();
    expect(savedRequest.receiver.toString()).toBe(receiver._id.toString());

    const receiverList = await request(app)
      .get('/api/receiver/requests')
      .set('Authorization', `Bearer ${receiverToken}`);
    expect(receiverList.status).toBe(200);
    expect(receiverList.body.map(item => item._id)).toContain(savedRequest._id.toString());

    const adminList = await request(app)
      .get('/api/admin/requests')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminList.status).toBe(200);
    expect(adminList.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ _id: savedRequest._id.toString(), receiver: expect.objectContaining({ name: receiver.name }) }),
    ]));

    const fulfilled = await request(app)
      .post(`/api/admin/requests/${savedRequest._id}/fulfill`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(fulfilled.status).toBe(200);
    expect((await FoodRequest.findById(savedRequest._id)).status).toBe('Fulfilled');

    const updatedList = await request(app)
      .get('/api/receiver/requests')
      .set('Authorization', `Bearer ${receiverToken}`);
    expect(updatedList.body[0].status).toBe('Fulfilled');
  });

  test('does not persist a request with missing required details', async () => {
    const registration = await registerAccount({ role: 'receiver' });
    expect(registration.status).toBe(201);
    const receiver = await User.findOne({ role: 'receiver' });
    await request(app)
      .post(`/api/admin/users/${receiver._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);
    const receiverLogin = await login(receiver.email);

    const response = await request(app)
      .post('/api/receiver/requests')
      .set('Authorization', `Bearer ${receiverLogin.body.token}`)
      .send({});
    expect(response.status).not.toBe(201);
    expect(await FoodRequest.countDocuments({ receiver: receiver._id })).toBe(0);
  });
});
