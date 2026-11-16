const Donation = require('../../../models/Donation');

describe('Donation model component', () => {
  const validDonation = () => ({
    donor: '507f1f77bcf86cd799439011',
    type: 'human',
    description: 'Prepared meal donation',
    quantity: 12,
    pickupAddress: '12 Test Road',
  });

  test('defaults status to Pending and validates a complete donation', () => {
    const donation = new Donation(validDonation());

    expect(donation.status).toBe('Pending');
    expect(donation.validateSync()).toBeUndefined();
  });

  test('requires donor, type, description, quantity, and pickup address', () => {
    const error = new Donation({}).validateSync();

    expect(Object.keys(error.errors)).toEqual(expect.arrayContaining([
      'donor', 'type', 'description', 'quantity', 'pickupAddress',
    ]));
  });

  test('rejects invalid donation type and status enums', () => {
    const error = new Donation({
      ...validDonation(),
      type: 'furniture',
      status: 'In Transit',
    }).validateSync();

    expect(error.errors.type).toBeDefined();
    expect(error.errors.status).toBeDefined();
  });

  test('declares user and task references on related fields', () => {
    expect(Donation.schema.path('donor').options.ref).toBe('User');
    expect(Donation.schema.path('assignedVolunteer').options.ref).toBe('User');
    expect(Donation.schema.path('currentTask').options.ref).toBe('Task');
  });
});
