const Activity = require('../../../models/Activity');

describe('Activity model component', () => {
  test('validates a supported activity type and allows an optional user reference', () => {
    const activity = new Activity({ text: 'A donation was assigned.', type: 'task_assigned' });

    expect(activity.userRef).toBeUndefined();
    expect(activity.validateSync()).toBeUndefined();
  });

  test('requires text and type and rejects unsupported activity types', () => {
    const error = new Activity({ type: 'task_deleted' }).validateSync();

    expect(error.errors.text).toBeDefined();
    expect(error.errors.type).toBeDefined();
  });

  test('references User when an activity is associated with a user', () => {
    expect(Activity.schema.path('userRef').options.ref).toBe('User');
  });
});
