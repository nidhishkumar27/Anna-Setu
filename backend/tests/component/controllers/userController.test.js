const User = require('../../../models/User');
const { getMyProfile, updateMyProfile } = require('../../../controllers/userController');
const { createResponse } = require('../helpers');

jest.mock('../../../models/User', () => ({ findById: jest.fn() }));

describe('User controller component', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { id: 'user-component-id' }, body: {}, params: {} };
    res = createResponse();
  });

  test('gets the current profile while selecting out the password', async () => {
    const profile = { _id: req.user.id, name: 'Profile User' };
    const query = { select: jest.fn().mockResolvedValue(profile) };
    User.findById.mockReturnValue(query);

    await getMyProfile(req, res);

    expect(User.findById).toHaveBeenCalledWith(req.user.id);
    expect(query.select).toHaveBeenCalledWith('-password');
    expect(res.json).toHaveBeenCalledWith(profile);
  });

  test('returns a generic 500 response if profile retrieval fails', async () => {
    User.findById.mockReturnValue({ select: jest.fn().mockRejectedValue(new Error('database detail')) });

    await getMyProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Server Error' });
  });

  test('preserves omitted profile and address fields during a partial update', async () => {
    const user = {
      name: 'Existing Name',
      phone: '1111111111',
      address: { street: 'Old Street', city: 'Old City', state: 'Old State', zip: '10000' },
      save: jest.fn(),
      toObject: jest.fn(),
    };
    user.save.mockImplementation(async () => user);
    user.toObject.mockImplementation(() => ({
      name: user.name,
      phone: user.phone,
      address: { ...user.address },
    }));
    User.findById.mockResolvedValue(user);
    req.body = { phone: '2222222222', address: { city: 'New City' } };

    await updateMyProfile(req, res);

    expect(user.name).toBe('Existing Name');
    expect(user.phone).toBe('2222222222');
    expect(user.address).toEqual({ street: 'Old Street', city: 'New City', state: 'Old State', zip: '10000' });
    expect(user.save).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Profile updated successfully',
      user: expect.objectContaining({ name: 'Existing Name', phone: '2222222222' }),
    }));
  });

  test('returns 404 when the authenticated profile no longer exists', async () => {
    User.findById.mockResolvedValue(null);

    await updateMyProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found' });
  });

  test('returns a generic 500 response if saving an update fails', async () => {
    User.findById.mockResolvedValue({
      name: 'Existing Name',
      save: jest.fn().mockRejectedValue(new Error('database detail')),
    });

    await updateMyProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Server Error' });
  });
});
