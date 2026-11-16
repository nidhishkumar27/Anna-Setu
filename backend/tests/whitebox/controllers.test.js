const User = require('../../models/User');
const Activity = require('../../models/Activity');
const jwt = require('jsonwebtoken');
const { registerUser, loginUser } = require('../../controllers/authController');

jest.mock('../../models/User', () => {
    const MockUser = jest.fn();
    MockUser.findOne = jest.fn();
    return MockUser;
});

jest.mock('../../models/Activity', () => {
    return jest.fn();
});

jest.mock('jsonwebtoken');

describe('WHITE-BOX TESTING: Authentication Controller', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        req = { body: {} };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        User.mockImplementation(function(data) {
            Object.assign(this, data);
            this._id = 'user-123';
            this.save = jest.fn().mockResolvedValue(this);
            this.comparePassword = jest.fn();
        });

        Activity.mockImplementation(function(data) {
            Object.assign(this, data);
            this.save = jest.fn().mockResolvedValue(this);
        });
    });

    describe('registerUser()', () => {
        test('should reject an already registered email', async () => {
            User.findOne.mockResolvedValue({ email: 'existing@test.com' });
            req.body = { email: 'existing@test.com' };

            await registerUser(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(User).not.toHaveBeenCalled();
        });

        test('should reject a regular donor without an FSSAI licence', async () => {
            User.findOne.mockResolvedValue(null);
            req.body = {
                name: 'Regular Donor',
                email: 'regular@test.com',
                password: 'password123',
                role: 'donor',
                donorType: 'regular'
            };

            await registerUser(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(User).not.toHaveBeenCalled();
        });

        test('should reject an invalid FSSAI licence number', async () => {
            User.findOne.mockResolvedValue(null);
            req.body = {
                name: 'Regular Donor',
                email: 'regular@test.com',
                password: 'password123',
                role: 'donor',
                donorType: 'regular',
                fssaiLicense: '12345'
            };

            await registerUser(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(User).not.toHaveBeenCalled();
        });

        test('should register a valid regular donor and normalize FSSAI licence', async () => {
            User.findOne.mockResolvedValue(null);
            req.body = {
                name: 'Regular Donor',
                email: 'regular@test.com',
                password: 'password123',
                role: 'donor',
                donorType: 'regular',
                fssaiLicense: '1234-5678 901234'
            };

            await registerUser(req, res);

            expect(User).toHaveBeenCalledWith(expect.objectContaining({
                email: 'regular@test.com',
                fssaiLicense: '12345678901234'
            }));
            expect(res.status).toHaveBeenCalledWith(201);
            expect(Activity).toHaveBeenCalled();
        });

        test('should automatically approve instant donors', async () => {
            User.findOne.mockResolvedValue(null);
            req.body = {
                name: 'Instant Donor',
                email: 'instant@test.com',
                password: 'password123',
                role: 'donor',
                donorType: 'instant'
            };

            await registerUser(req, res);

            expect(User.mock.instances[0].status).toBe('approved');
            expect(res.status).toHaveBeenCalledWith(201);
        });

        test('should create a registration activity record', async () => {
            User.findOne.mockResolvedValue(null);
            req.body = {
                name: 'Test Volunteer',
                email: 'volunteer@test.com',
                password: 'password123',
                role: 'volunteer'
            };

            await registerUser(req, res);

            expect(Activity).toHaveBeenCalledWith(expect.objectContaining({
                text: 'Test Volunteer registered as a new volunteer.',
                type: 'user_registered',
                userRef: 'user-123'
            }));
        });
    });

    describe('loginUser()', () => {
        test('should reject an unknown email', async () => {
            User.findOne.mockResolvedValue(null);
            req.body = { email: 'unknown@test.com', password: 'password123' };

            await loginUser(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
        });

        test('should reject an incorrect password', async () => {
            const user = {
                comparePassword: jest.fn().mockResolvedValue(false)
            };
            User.findOne.mockResolvedValue(user);
            req.body = { email: 'user@test.com', password: 'wrongpassword' };

            await loginUser(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(jwt.sign).not.toHaveBeenCalled();
        });

        test('should block users whose accounts are pending', async () => {
            const user = {
                comparePassword: jest.fn().mockResolvedValue(true),
                status: 'pending'
            };
            User.findOne.mockResolvedValue(user);
            req.body = { email: 'pending@test.com', password: 'password123' };

            await loginUser(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(jwt.sign).not.toHaveBeenCalled();
        });

        test('should generate a JWT for an approved user', async () => {
            const user = {
                _id: 'user-123',
                name: 'Approved Donor',
                email: 'donor@test.com',
                role: 'donor',
                donorType: 'instant',
                status: 'approved',
                comparePassword: jest.fn().mockResolvedValue(true)
            };

            User.findOne.mockResolvedValue(user);
            jwt.sign.mockReturnValue('mock-jwt-token');

            req.body = {
                email: 'donor@test.com',
                password: 'password123'
            };

            await loginUser(req, res);

            expect(jwt.sign).toHaveBeenCalledWith(
                { id: 'user-123', role: 'donor' },
                'test-secret',
                { expiresIn: '3d' }
            );

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                token: 'mock-jwt-token'
            }));
        });
    });
});
