const jwt = require('jsonwebtoken');
const authMiddleware = require('../../../middleware/authMiddleware');
const { createResponse } = require('../helpers');

describe('Authentication middleware component with real JWT verification', () => {
  const originalSecret = process.env.JWT_SECRET;
  const secret = 'component-local-jwt-secret';

  beforeEach(() => {
    process.env.JWT_SECRET = secret;
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  });

  test('attaches verified claims from a signed bearer token and calls next once', () => {
    const claims = { id: 'component-user-id', role: 'volunteer' };
    const token = jwt.sign(claims, secret, { expiresIn: '1m' });
    const req = { header: jest.fn().mockReturnValue(`Bearer ${token}`) };
    const res = createResponse();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(req.user).toMatchObject(claims);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('rejects a validly signed token when its signing secret does not match', () => {
    const token = jwt.sign({ id: 'component-user-id', role: 'admin' }, 'different-secret');
    const req = { header: jest.fn().mockReturnValue(`Bearer ${token}`) };
    const res = createResponse();
    const next = jest.fn();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Token is not valid.' });
    expect(next).not.toHaveBeenCalled();
  });
});
