const Request = require('../../models/Request');
const Task = require('../../models/Task');
const Donation = require('../../models/Donation');

const {
    createRequest,
    getMyRequests,
    getUpcomingDeliveries,
    confirmReceipt,
    getDeliveryHistory
} = require('../../controllers/receiverController');

jest.mock('../../models/Request', () => {
    const MockRequest = jest.fn();
    MockRequest.find = jest.fn();
    return MockRequest;
});

jest.mock('../../models/Task', () => ({
    find: jest.fn(),
    findOne: jest.fn()
}));

jest.mock('../../models/Donation', () => ({
    findByIdAndUpdate: jest.fn()
}));

describe('WHITE-BOX TESTING: Receiver Controller', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            user: { id: 'receiver-123' },
            body: { details: 'Need food for my family' },
            params: { id: 'task-123' }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        Request.mockImplementation(function(data) {
            Object.assign(this, data);
            this.save = jest.fn().mockResolvedValue(this);
        });
    });

    describe('createRequest()', () => {
        test('should create a request successfully', async () => {
            await createRequest(req, res);

            expect(Request).toHaveBeenCalledWith({
                receiver: 'receiver-123',
                details: 'Need food for my family'
            });
            expect(res.status).toHaveBeenCalledWith(201);
        });

        test('should return 500 when saving request fails', async () => {
            Request.mockImplementationOnce(function(data) {
                Object.assign(this, data);
                this.save = jest.fn().mockRejectedValue(new Error('Database error'));
            });

            await createRequest(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getMyRequests()', () => {
        test('should retrieve only the logged-in receiver requests', async () => {
            const requests = [{ _id: 'request-1' }];
            const sortMock = jest.fn().mockResolvedValue(requests);

            Request.find.mockReturnValue({ sort: sortMock });

            await getMyRequests(req, res);

            expect(Request.find).toHaveBeenCalledWith({
                receiver: 'receiver-123'
            });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(requests);
        });

        test('should sort requests by newest first', async () => {
            const sortMock = jest.fn().mockResolvedValue([]);
            Request.find.mockReturnValue({ sort: sortMock });

            await getMyRequests(req, res);

            expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
        });

        test('should return 500 when request retrieval fails', async () => {
            Request.find.mockReturnValue({
                sort: jest.fn().mockRejectedValue(new Error('Database error'))
            });

            await getMyRequests(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getUpcomingDeliveries()', () => {
        test('should filter deliveries by receiver and allowed statuses', async () => {
            const sortMock = jest.fn().mockResolvedValue([]);
            const populateVolunteer = jest.fn().mockReturnValue({ sort: sortMock });
            const populateDonation = jest.fn().mockReturnValue({
                populate: populateVolunteer
            });

            Task.find.mockReturnValue({
                populate: populateDonation
            });

            await getUpcomingDeliveries(req, res);

            expect(Task.find).toHaveBeenCalledWith({
                receiver: 'receiver-123',
                status: { $in: ['Accepted', 'In-Transit', 'Delivered'] }
            });
        });

        test('should populate donation, donor and volunteer details', async () => {
            const sortMock = jest.fn().mockResolvedValue([]);
            const populateVolunteer = jest.fn().mockReturnValue({ sort: sortMock });
            const populateDonation = jest.fn().mockReturnValue({
                populate: populateVolunteer
            });

            Task.find.mockReturnValue({
                populate: populateDonation
            });

            await getUpcomingDeliveries(req, res);

            expect(populateDonation).toHaveBeenCalledWith({
                path: 'donation',
                select: 'description quantity',
                populate: { path: 'donor', select: 'name' }
            });

            expect(populateVolunteer).toHaveBeenCalledWith(
                'volunteer',
                'name phone'
            );
        });

        test('should return 500 when delivery retrieval fails', async () => {
            Task.find.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockReturnValue({
                        sort: jest.fn().mockRejectedValue(new Error('Database error'))
                    })
                })
            });

            await getUpcomingDeliveries(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('confirmReceipt()', () => {
        test('should return 404 if task does not belong to receiver or does not exist', async () => {
            Task.findOne.mockResolvedValue(null);

            await confirmReceipt(req, res);

            expect(Task.findOne).toHaveBeenCalledWith({
                _id: 'task-123',
                receiver: 'receiver-123'
            });
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test('should complete task and associated donation', async () => {
            const task = {
                donation: 'donation-123',
                status: 'Delivered',
                save: jest.fn().mockResolvedValue(true)
            };

            Task.findOne.mockResolvedValue(task);
            Donation.findByIdAndUpdate.mockResolvedValue(true);

            await confirmReceipt(req, res);

            expect(task.status).toBe('Completed');
            expect(task.save).toHaveBeenCalled();
            expect(Donation.findByIdAndUpdate).toHaveBeenCalledWith(
                'donation-123',
                { status: 'Completed' }
            );
            expect(res.status).toHaveBeenCalledWith(200);
        });

        test('should return 500 when task update fails', async () => {
            Task.findOne.mockRejectedValue(new Error('Database error'));

            await confirmReceipt(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getDeliveryHistory()', () => {
        test('should retrieve only completed deliveries for receiver', async () => {
            const tasks = [{ _id: 'task-1', status: 'Completed' }];
            const sortMock = jest.fn().mockResolvedValue(tasks);
            const populateMock = jest.fn().mockReturnValue({ sort: sortMock });

            Task.find.mockReturnValue({ populate: populateMock });

            await getDeliveryHistory(req, res);

            expect(Task.find).toHaveBeenCalledWith({
                receiver: 'receiver-123',
                status: 'Completed'
            });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(tasks);
        });

        test('should populate donation and donor information', async () => {
            const populateMock = jest.fn().mockReturnValue({
                sort: jest.fn().mockResolvedValue([])
            });

            Task.find.mockReturnValue({ populate: populateMock });

            await getDeliveryHistory(req, res);

            expect(populateMock).toHaveBeenCalledWith({
                path: 'donation',
                select: 'description quantity',
                populate: { path: 'donor', select: 'name' }
            });
        });

        test('should sort delivery history by most recently updated', async () => {
            const sortMock = jest.fn().mockResolvedValue([]);
            Task.find.mockReturnValue({
                populate: jest.fn().mockReturnValue({ sort: sortMock })
            });

            await getDeliveryHistory(req, res);

            expect(sortMock).toHaveBeenCalledWith({ updatedAt: -1 });
        });

        test('should return 500 when history retrieval fails', async () => {
            Task.find.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    sort: jest.fn().mockRejectedValue(new Error('Database error'))
                })
            });

            await getDeliveryHistory(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
});
