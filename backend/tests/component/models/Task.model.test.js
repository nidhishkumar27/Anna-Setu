const Task = require('../../../models/Task');

describe('Task model component', () => {
  const validTask = () => ({
    donation: '507f1f77bcf86cd799439011',
    volunteer: '507f1f77bcf86cd799439012',
    receiver: '507f1f77bcf86cd799439013',
  });

  test('defaults status to Pending Acceptance and validates required references', () => {
    const task = new Task(validTask());

    expect(task.status).toBe('Pending Acceptance');
    expect(task.validateSync()).toBeUndefined();
  });

  test('requires donation, volunteer, and receiver references', () => {
    const error = new Task({}).validateSync();

    expect(Object.keys(error.errors)).toEqual(expect.arrayContaining(['donation', 'volunteer', 'receiver']));
  });

  test('rejects an unsupported task status', () => {
    const error = new Task({ ...validTask(), status: 'Queued' }).validateSync();

    expect(error.errors.status).toBeDefined();
  });

  test('declares references to donation and user models', () => {
    expect(Task.schema.path('donation').options.ref).toBe('Donation');
    expect(Task.schema.path('volunteer').options.ref).toBe('User');
    expect(Task.schema.path('receiver').options.ref).toBe('User');
  });
});
