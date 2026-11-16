const User = require('../../models/User');
const Task = require('../../models/Task');
const Activity = require('../../models/Activity');
const Donation = require('../../models/Donation');
const Request = require('../../models/Request');
const CompostSale = require('../../models/CompostSale');

const {
    getDashboardStats,
    getRecentActivity,
    getPendingUsers,
    getAllUsers,
    approveUser,
    rejectUser,
    getPendingDonations,
    getAllTasks,
    fulfillRequest,
    assignTask,
    getCompostDonations,
    logCompostSale,
    getSalesHistory
} = require('../../controllers/adminController');

jest.mock('../../models/User', () => ({
    countDocuments: jest.fn(),
    find: jest.fn(),
    findById: jest.fn()
}));

jest.mock('../../models/Task', () => ({
    find: jest.fn()
}));

jest.mock('../../models/Activity', () => {
    const MockActivity = jest.fn();
    MockActivity.find = jest.fn();
    return MockActivity;
});

jest.mock('../../models/Donation', () => {
    const MockDonation = jest.fn();
    MockDonation.find = jest.fn();
    MockDonation.findById = jest.fn();
    return MockDonation;
});
jest.mock('../../models/CompostSale', () => {
    const MockCompostSale = jest.fn();
    MockCompostSale.find = jest.fn();
    return MockCompostSale;
});
jest.mock('../../models/Request', () => {
    const MockRequest = jest.fn();
    MockRequest.findById = jest.fn();
    return MockRequest;
});

describe('WHITE-BOX TESTING: Admin Controller', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = { query: {}, params: {}, body: {} };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
    });

    describe('getDashboardStats()', () => {
        test('should retrieve all dashboard user statistics', async () => {
            User.countDocuments
                .mockResolvedValueOnce(10)
                .mockResolvedValueOnce(8)
                .mockResolvedValueOnce(5)
                .mockResolvedValueOnce(2)
                .mockResolvedValueOnce(3)
                .mockResolvedValueOnce(4);

            Task.find.mockReturnValue({
                populate: jest.fn().mockResolvedValue([])
            });

            await getDashboardStats(req, res);

            expect(User.countDocuments).toHaveBeenNthCalledWith(1, {
                role: 'donor', status: 'approved'
            });
            expect(User.countDocuments).toHaveBeenNthCalledWith(2, {
                role: 'receiver', status: 'approved'
            });
            expect(User.countDocuments).toHaveBeenNthCalledWith(3, {
                role: 'volunteer', status: 'approved'
            });

            expect(res.status).toHaveBeenCalledWith(200);
        });

        test('should calculate meals served from completed donation quantities', async () => {
            User.countDocuments.mockResolvedValue(0);

            Task.find.mockReturnValue({
                populate: jest.fn().mockResolvedValue([
                    { donation: { quantity: 10 } },
                    { donation: { quantity: 20 } },
                    { donation: null }
                ])
            });

            await getDashboardStats(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                mealsServed: 75
            }));
        });

        test('should return 500 when dashboard statistics retrieval fails', async () => {
            User.countDocuments.mockRejectedValue(
                new Error('Database unavailable')
            );

            await getDashboardStats(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getRecentActivity()', () => {
        test('should retrieve the latest 10 activities', async () => {
            const activities = [{ text: 'User registered' }];

            const limitMock = jest.fn().mockResolvedValue(activities);
            const sortMock = jest.fn().mockReturnValue({
                limit: limitMock
            });

            Activity.find.mockReturnValue({
                sort: sortMock
            });

            await getRecentActivity(req, res);

            expect(Activity.find).toHaveBeenCalled();
            expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
            expect(limitMock).toHaveBeenCalledWith(10);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(activities);
        });

        test('should return 500 when activity retrieval fails', async () => {
            Activity.find.mockReturnValue({
                sort: jest.fn().mockReturnValue({
                    limit: jest.fn().mockRejectedValue(
                        new Error('Database unavailable')
                    )
                })
            });

            await getRecentActivity(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
});



describe('WHITE-BOX TESTING: Admin User Management', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = { query: {}, params: {}, body: {} };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
    });

    test('should retrieve pending users without exposing passwords', async () => {
        const users = [
            {
                name: 'Test Donor',
                email: 'donor@example.com',
                toObject: () => ({
                    name: 'Test Donor',
                    email: 'donor@example.com'
                })
            }
        ];

        const sortMock = jest.fn().mockResolvedValue(users);
        const selectMock = jest.fn().mockReturnValue({ sort: sortMock });

        User.find.mockReturnValue({ select: selectMock });

        await getPendingUsers(req, res);

        expect(User.find).toHaveBeenCalledWith({ status: 'pending' });
        expect(selectMock).toHaveBeenCalledWith('-password');
        expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalled();
    });

    test('should normalize missing FSSAI licence values', async () => {
        const users = [{
            toObject: () => ({ name: 'Test User' })
        }];

        User.find.mockReturnValue({
            select: jest.fn().mockReturnValue({
                sort: jest.fn().mockResolvedValue(users)
            })
        });

        await getPendingUsers(req, res);

        expect(res.json).toHaveBeenCalledWith([
            expect.objectContaining({ fssaiLicense: '' })
        ]);
    });

    test('should retrieve all users using role and status filters', async () => {
        req.query = {
            role: 'donor',
            status: 'approved'
        };

        User.find.mockReturnValue({
            select: jest.fn().mockReturnValue({
                sort: jest.fn().mockResolvedValue([])
            })
        });

        await getAllUsers(req, res);

        expect(User.find).toHaveBeenCalledWith({
            role: 'donor',
            status: 'approved'
        });
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('should retrieve all users without filters when none are provided', async () => {
        User.find.mockReturnValue({
            select: jest.fn().mockReturnValue({
                sort: jest.fn().mockResolvedValue([])
            })
        });

        await getAllUsers(req, res);

        expect(User.find).toHaveBeenCalledWith({});
        expect(res.status).toHaveBeenCalledWith(200);
    });
});




describe('WHITE-BOX TESTING: Admin User Approval and Rejection', () => {
    let req, res, mockUser, mockActivitySave;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            params: { id: 'user123' },
            query: {},
            body: {}
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        mockUser = {
            _id: 'user123',
            name: 'Test Donor',
            status: 'pending',
            save: jest.fn().mockResolvedValue(true)
        };

        mockActivitySave = jest.fn().mockResolvedValue(true);

        Activity.mockImplementation(() => ({
            save: mockActivitySave
        }));
    });

    test('should approve an existing user', async () => {
        User.findById.mockResolvedValue(mockUser);

        await approveUser(req, res);

        expect(User.findById).toHaveBeenCalledWith('user123');
        expect(mockUser.status).toBe('approved');
        expect(mockUser.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('should record an approval activity', async () => {
        User.findById.mockResolvedValue(mockUser);

        await approveUser(req, res);

        expect(Activity).toHaveBeenCalledWith(expect.objectContaining({
            text: 'Admin approved the account for Test Donor.',
            type: 'user_approved',
            userRef: 'user123'
        }));

        expect(mockActivitySave).toHaveBeenCalled();
    });

    test('should return 404 when approving a nonexistent user', async () => {
        User.findById.mockResolvedValue(null);

        await approveUser(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(Activity).not.toHaveBeenCalled();
    });

    test('should reject an existing user and record the activity', async () => {
        User.findById.mockResolvedValue(mockUser);

        await rejectUser(req, res);

        expect(mockUser.status).toBe('rejected');
        expect(mockUser.save).toHaveBeenCalled();

        expect(Activity).toHaveBeenCalledWith(expect.objectContaining({
            text: 'Admin rejected the account for Test Donor.',
            type: 'user_rejected'
        }));

        expect(mockActivitySave).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('should return 404 when rejecting a nonexistent user', async () => {
        User.findById.mockResolvedValue(null);

        await rejectUser(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(Activity).not.toHaveBeenCalled();
    });
});




describe('WHITE-BOX TESTING: Admin Donation and Request Management', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = { query: {}, params: { id: 'request123' }, body: {} };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
    });

    test('should retrieve donations awaiting assignment', async () => {
        const donations = [{ status: 'Pending' }];
        const populateMock = jest.fn().mockResolvedValue(donations);

        Donation.find.mockReturnValue({ populate: populateMock });

        await getPendingDonations(req, res);

        expect(Donation.find).toHaveBeenCalledWith({ status: 'Pending' });
        expect(populateMock).toHaveBeenCalledWith('donor', 'name organizationName');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(donations);
    });

    test('should return 500 when pending donations retrieval fails', async () => {
        Donation.find.mockReturnValue({
            populate: jest.fn().mockRejectedValue(new Error('Database error'))
        });

        await getPendingDonations(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });

    test('should retrieve all tasks with populated related records', async () => {
        const tasks = [{ status: 'Completed' }];

        const sortMock = jest.fn().mockResolvedValue(tasks);
        const receiverPopulate = jest.fn().mockReturnValue({ sort: sortMock });
        const volunteerPopulate = jest.fn().mockReturnValue({ populate: receiverPopulate });
        const donationPopulate = jest.fn().mockReturnValue({ populate: volunteerPopulate });

        Task.find.mockReturnValue({ populate: donationPopulate });

        await getAllTasks(req, res);

        expect(Task.find).toHaveBeenCalled();
        expect(donationPopulate).toHaveBeenCalledWith({
            path: 'donation', select: 'description quantity'
        });
        expect(volunteerPopulate).toHaveBeenCalledWith({
            path: 'volunteer', select: 'name'
        });
        expect(receiverPopulate).toHaveBeenCalledWith({
            path: 'receiver', select: 'name'
        });
        expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(tasks);
    });

    test('should return 500 when task retrieval fails', async () => {
        const query = {
            populate: jest.fn().mockReturnThis(),
            sort: jest.fn().mockRejectedValue(new Error('Database error'))
        };

        Task.find.mockReturnValue(query);

        await getAllTasks(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });

    test('should mark an existing request as fulfilled', async () => {
        const request = {
            status: 'Open',
            save: jest.fn().mockResolvedValue(true)
        };

        Request.findById.mockResolvedValue(request);

        await fulfillRequest(req, res);

        expect(Request.findById).toHaveBeenCalledWith('request123');
        expect(request.status).toBe('Fulfilled');
        expect(request.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('should return 404 when the request does not exist', async () => {
        Request.findById.mockResolvedValue(null);

        await fulfillRequest(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('should return 500 when fulfilling a request fails', async () => {
        Request.findById.mockRejectedValue(new Error('Database error'));

        await fulfillRequest(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});


