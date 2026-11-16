const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const Donation = require('../../models/Donation');
const Task = require('../../models/Task');
const { connect, closeDatabase, clearDatabase } = require('../setup');
const { registerAccount, login, createAdmin } = require('./helpers');

beforeAll(async () => {
  process.env.JWT_SECRET = 'acceptance-test-secret';
  await connect();
});
afterAll(closeDatabase);
afterEach(clearDatabase);

describe('Complete donation lifecycle acceptance', () => {
  test('donation moves from donor submission through assignment, delivery, and receiver confirmation', async () => {
    const admin = await createAdmin();
    expect(admin.loginResponse.status).toBe(200);

    const registrations = await Promise.all([
      registerAccount({ role: 'donor', donorType: 'instant' }),
      registerAccount({ role: 'donor', donorType: 'instant' }),
      registerAccount({ role: 'volunteer' }),
      registerAccount({ role: 'volunteer' }),
      registerAccount({ role: 'receiver' }),
      registerAccount({ role: 'receiver' }),
    ]);
    registrations.forEach(response => expect(response.status).toBe(201));

    const [donors, volunteers, receivers] = await Promise.all([
      User.find({ role: 'donor' }).sort({ createdAt: 1 }),
      User.find({ role: 'volunteer' }).sort({ createdAt: 1 }),
      User.find({ role: 'receiver' }).sort({ createdAt: 1 }),
    ]);

    for (const user of [...volunteers, ...receivers]) {
      const approval = await request(app)
        .post(`/api/admin/users/${user._id}/approve`)
        .set('Authorization', `Bearer ${admin.token}`);
      expect(approval.status).toBe(200);
    }

    const [donorLogin, otherDonorLogin, volunteerLogin, otherVolunteerLogin, receiverLogin, otherReceiverLogin] = await Promise.all([
      login(donors[0].email),
      login(donors[1].email),
      login(volunteers[0].email),
      login(volunteers[1].email),
      login(receivers[0].email),
      login(receivers[1].email),
    ]);
    [donorLogin, otherDonorLogin, volunteerLogin, otherVolunteerLogin, receiverLogin, otherReceiverLogin]
      .forEach(response => expect(response.status).toBe(200));

    const donorToken = donorLogin.body.token;
    const otherDonorToken = otherDonorLogin.body.token;
    const volunteerToken = volunteerLogin.body.token;
    const otherVolunteerToken = otherVolunteerLogin.body.token;
    const receiverToken = receiverLogin.body.token;
    const otherReceiverToken = otherReceiverLogin.body.token;

    const invalidDonation = await request(app)
      .post('/api/donor')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({ type: 'human', description: 'Missing quantity and pickup address' });
    expect(invalidDonation.status).not.toBe(201);
    expect(await Donation.countDocuments()).toBe(0);

    const submitted = await request(app)
      .post('/api/donor')
      .set('Authorization', `Bearer ${donorToken}`)
      .send({
        type: 'human',
        description: 'Fresh vegetables for the community kitchen',
        quantity: 12,
        pickupAddress: '15 Market Road',
        additionalGuidelines: 'Keep refrigerated until pickup.',
      });
    expect(submitted.status).toBe(201);
    expect(submitted.body.donation).toMatchObject({
      type: 'human',
      description: 'Fresh vegetables for the community kitchen',
      quantity: 12,
      status: 'Pending',
      donor: donors[0]._id.toString(),
    });
    const donationId = submitted.body.donation._id;

    const donorHistory = await request(app).get('/api/donor').set('Authorization', `Bearer ${donorToken}`);
    const otherDonorHistory = await request(app).get('/api/donor').set('Authorization', `Bearer ${otherDonorToken}`);
    expect(donorHistory.status).toBe(200);
    expect(donorHistory.body.map(item => item._id)).toContain(donationId);
    expect(otherDonorHistory.status).toBe(200);
    expect(otherDonorHistory.body).toEqual([]);

    const pendingDonations = await request(app)
      .get('/api/admin/pending-donations')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(pendingDonations.status).toBe(200);
    expect(pendingDonations.body.map(item => item._id)).toContain(donationId);

    const assigned = await request(app)
      .post('/api/admin/assign-task')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ donationId, volunteerId: volunteers[0]._id.toString(), receiverId: receivers[0]._id.toString() });
    expect(assigned.status).toBe(201);
    const taskId = assigned.body.task._id;
    expect(assigned.body.task).toMatchObject({
      donation: donationId,
      volunteer: volunteers[0]._id.toString(),
      receiver: receivers[0]._id.toString(),
      status: 'Pending Acceptance',
    });

    let persistedDonation = await Donation.findById(donationId);
    expect(persistedDonation.status).toBe('Assigned');
    expect(persistedDonation.assignedVolunteer.toString()).toBe(volunteers[0]._id.toString());
    expect(persistedDonation.currentTask.toString()).toBe(taskId);

    const adminTasks = await request(app).get('/api/admin/tasks').set('Authorization', `Bearer ${admin.token}`);
    expect(adminTasks.status).toBe(200);
    expect(adminTasks.body.map(item => item._id)).toContain(taskId);

    const otherVolunteerUpdate = await request(app)
      .patch(`/api/volunteer/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${otherVolunteerToken}`)
      .send({ status: 'Accepted' });
    expect(otherVolunteerUpdate.status).toBe(404);
    expect((await Task.findById(taskId)).status).toBe('Pending Acceptance');
    expect((await Donation.findById(donationId)).status).toBe('Assigned');

    const volunteerTasks = await request(app).get('/api/volunteer/tasks').set('Authorization', `Bearer ${volunteerToken}`);
    expect(volunteerTasks.status).toBe(200);
    expect(volunteerTasks.body.map(item => item._id)).toContain(taskId);
    expect(volunteerTasks.body.find(item => item._id === taskId).donation.description)
      .toBe('Fresh vegetables for the community kitchen');

    const invalidStatus = await request(app)
      .patch(`/api/volunteer/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${volunteerToken}`)
      .send({ status: 'NotAValidStatus' });
    expect(invalidStatus.status).toBe(500);
    expect((await Task.findById(taskId)).status).toBe('Pending Acceptance');

    const accepted = await request(app)
      .patch(`/api/volunteer/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${volunteerToken}`)
      .send({ status: 'Accepted' });
    expect(accepted.status).toBe(200);
    expect((await Task.findById(taskId)).status).toBe('Accepted');

    const pickedUp = await request(app)
      .patch(`/api/volunteer/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${volunteerToken}`)
      .send({
        status: 'Picked Up',
        qualityCheck: { foodQuality: 'Good', packaging: 'Good', remarks: 'Fresh and sealed.' },
      });
    expect(pickedUp.status).toBe(200);
    expect((await Task.findById(taskId)).qualityCheck.foodQuality).toBe('Good');
    expect((await Donation.findById(donationId)).status).toBe('Picked Up');

    const delivered = await request(app)
      .patch(`/api/volunteer/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${volunteerToken}`)
      .send({ status: 'Delivered' });
    expect(delivered.status).toBe(200);
    expect((await Task.findById(taskId)).status).toBe('Delivered');
    expect((await Donation.findById(donationId)).status).toBe('Delivered');

    const upcoming = await request(app)
      .get('/api/receiver/deliveries/upcoming')
      .set('Authorization', `Bearer ${receiverToken}`);
    expect(upcoming.status).toBe(200);
    expect(upcoming.body.map(item => item._id)).toContain(taskId);

    const wrongReceiverConfirm = await request(app)
      .post(`/api/receiver/tasks/${taskId}/confirm`)
      .set('Authorization', `Bearer ${otherReceiverToken}`);
    expect(wrongReceiverConfirm.status).toBe(404);
    expect((await Task.findById(taskId)).status).toBe('Delivered');
    expect((await Donation.findById(donationId)).status).toBe('Delivered');

    const confirmed = await request(app)
      .post(`/api/receiver/tasks/${taskId}/confirm`)
      .set('Authorization', `Bearer ${receiverToken}`);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.message).toMatch(/receipt confirmed/i);
    expect((await Task.findById(taskId)).status).toBe('Completed');
    persistedDonation = await Donation.findById(donationId);
    expect(persistedDonation.status).toBe('Completed');

    const [deliveryHistory, finalDonorHistory, volunteerStats, adminStats] = await Promise.all([
      request(app).get('/api/receiver/deliveries/history').set('Authorization', `Bearer ${receiverToken}`),
      request(app).get('/api/donor').set('Authorization', `Bearer ${donorToken}`),
      request(app).get('/api/volunteer/stats').set('Authorization', `Bearer ${volunteerToken}`),
      request(app).get('/api/admin/stats').set('Authorization', `Bearer ${admin.token}`),
    ]);
    expect(deliveryHistory.status).toBe(200);
    expect(deliveryHistory.body.map(item => item._id)).toContain(taskId);
    expect(finalDonorHistory.body.find(item => item._id === donationId).status).toBe('Completed');
    expect(volunteerStats.body).toMatchObject({ tasksCompleted: 1, activeTasks: 0, mealsServed: 30 });
    expect(adminStats.body.mealsServed).toBe(30);
  });
});
