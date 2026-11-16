const jwt = require('jsonwebtoken');
const authMiddleware = require('../../middleware/authMiddleware');
const { authorize } = require('../../middleware/authorize');

jest.mock('jsonwebtoken');

describe('WHITE-BOX TESTING: Authentication Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            header: jest.fn()
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        next = jest.fn();
        process.env.JWT_SECRET = 'test-secret';
    });

    test('should reject requests without an Authorization header', () => {
        req.header.mockReturnValue(undefined);

        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('should reject an empty Bearer token', () => {
        req.header.mockReturnValue('Bearer ');

        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('should reject invalid JWT tokens', () => {
        req.header.mockReturnValue('Bearer invalid-token');
        jwt.verify.mockImplementation(() => {
            throw new Error('Invalid token');
        });

        authMiddleware(req, res, next);

        expect(jwt.verify).toHaveBeenCalledWith('invalid-token', 'test-secret');
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            message: 'Token is not valid.'
        });
        expect(next).not.toHaveBeenCalled();
    });

    test('should reject expired JWT tokens', () => {
        req.header.mockReturnValue('Bearer expired-token');
        jwt.verify.mockImplementation(() => {
            throw new Error('jwt expired');
        });

        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('should authenticate a valid JWT and attach decoded user data', () => {
        const decodedUser = {
            id: 'user123',
            role: 'donor'
        };

        req.header.mockReturnValue('Bearer valid-token');
        jwt.verify.mockReturnValue(decodedUser);

        authMiddleware(req, res, next);

        expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
        expect(req.user).toEqual(decodedUser);
        expect(next).toHaveBeenCalledTimes(1);
    });
});

describe('WHITE-BOX TESTING: Role Authorization Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
    });

    test('should allow an admin to access an admin-only route', () => {
        req.user = { role: 'admin' };

        authorize('admin')(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
    });

    test('should allow a donor to access a donor-only route', () => {
        req.user = { role: 'donor' };

        authorize('donor')(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
    });

    test('should reject a donor accessing an admin-only route', () => {
        req.user = { role: 'donor' };

        authorize('admin')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    test('should reject requests without an authenticated user', () => {
        authorize('admin')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    test('should reject users with an unrecognized role', () => {
        req.user = { role: 'unknown' };

        authorize('admin', 'donor')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    test('should allow any one of multiple permitted roles', () => {
        req.user = { role: 'volunteer' };

        authorize('admin', 'volunteer')(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
    });
});
