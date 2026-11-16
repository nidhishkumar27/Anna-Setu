const Request = require('../../../models/Request');

describe('Request model component', () => {
  test('defaults status to Open and trims request details', () => {
    const request = new Request({
      receiver: '507f1f77bcf86cd799439011',
      details: '  Need food for a community event.  ',
    });

    expect(request.status).toBe('Open');
    expect(request.details).toBe('Need food for a community event.');
    expect(request.validateSync()).toBeUndefined();
  });

  test('requires receiver and details and rejects unsupported status', () => {
    const error = new Request({ status: 'Pending' }).validateSync();

    expect(error.errors.receiver).toBeDefined();
    expect(error.errors.details).toBeDefined();
    expect(error.errors.status).toBeDefined();
  });

  test('references the User model for receiver ownership', () => {
    expect(Request.schema.path('receiver').options.ref).toBe('User');
  });
});
