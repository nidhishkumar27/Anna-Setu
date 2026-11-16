const Task = require('../../models/Task');
const Donation = require('../../models/Donation');

const {
    getVolunteerStats,
    getAssignedTasks,
    updateTaskStatus
} = require('../../controllers/volunteerController');

jest.mock('../../models/Task', () => ({
    countDocuments: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn()
}));

jest.mock('../../models/Donation', () => ({
    findByIdAndUpdate: jest.fn()
}));

jest.mock('../../models/User', () => ({}));

describe('WHITE-BOX TESTING: Volunteer Controller', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            user: { id: 'volunteer-123' },
            params: { id: 'task-123' },
            body: {
                status: 'Picked Up',
                qualityCheck: {
                    foodQuality: 'Good',
                    packaging: 'Good',
                    remarks: 'Food is fresh'
                }
            }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
    });

    describe('getVolunteerStats()', () => {
        test('should calculate completed tasks and active tasks', async () => {
            Task.countDocuments
                .mockResolvedValueOnce(5)
                .mockResolvedValueOnce(2);

            Task.find.mockReturnValue({
                populate: jest.fn().mockResolvedValue([])
            });

            await getVolunteerStats(req, res);

            expect(Task.countDocuments).toHaveBeenNthCalledWith(1, {
                volunteer: 'volunteer-123',
                status: 'Completed'
            });

            expect(Task.countDocuments).toHaveBeenNthCalledWith(2, {
                volunteer: 'volunteer-123',
                status: { $in: ['Accepted', 'Picked Up'] }
            });

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                tasksCompleted: 5,
                activeTasks: 2,
                mealsServed: 0
            });
        });

        test('should calculate meals served from delivered kilograms', async () => {
            Task.countDocuments
                .mockResolvedValueOnce(4)
                .mockResolvedValueOnce(3);

            Task.find.mockReturnValue({
                populate: jest.fn().mockResolvedValue([
                    { donation: { quantity: 10 } },
                    { donation: { quantity: 20 } },
                    { donation: null }
                ])
            });

            await getVolunteerStats(req, res);

            expect(res.json).toHaveBeenCalledWith({
                tasksCompleted: 4,
                activeTasks: 3,
                mealsServed: 75
            });
        });

        test('should return 500 when statistics retrieval fails', async () => {
            Task.countDocuments.mockRejectedValue(
                new Error('Database unavailable')
            );

            await getVolunteerStats(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('getAssignedTasks()', () => {
        test('should retrieve tasks assigned to the logged-in volunteer', async () => {
            const tasks = [{ _id: 'task-123' }];
            const sortMock = jest.fn().mockResolvedValue(tasks);
            const populateReceiver = jest.fn().mockReturnValue({
                sort: sortMock
            });
            const populateDonation = jest.fn().mockReturnValue({
                populate: populateReceiver
            });

            Task.find.mockReturnValue({
                populate: populateDonation
            });

            await getAssignedTasks(req, res);

            expect(Task.find).toHaveBeenCalledWith({
                volunteer: 'volunteer-123'
            });
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(tasks);
        });

        test('should populate donation, donor and receiver information', async () => {
            const sortMock = jest.fn().mockResolvedValue([]);
            const populateReceiver = jest.fn().mockReturnValue({
                sort: sortMock
            });
            const populateDonation = jest.fn().mockReturnValue({
                populate: populateReceiver
            });

            Task.find.mockReturnValue({
                populate: populateDonation
            });

            await getAssignedTasks(req, res);

            expect(populateDonation).toHaveBeenCalledWith({
                path: 'donation',
                select: 'description quantity pickupAddress additionalGuidelines',
                populate: { path: 'donor', select: 'name phone' }
            });

            expect(populateReceiver).toHaveBeenCalledWith(
                'receiver',
                'name address phone'
            );
        });

        test('should sort assigned tasks by newest first', async () => {
            const sortMock = jest.fn().mockResolvedValue([]);
            const populateReceiver = jest.fn().mockReturnValue({
                sort: sortMock
            });

            Task.find.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: populateReceiver
                })
            });

            await getAssignedTasks(req, res);

            expect(sortMock).toHaveBeenCalledWith({
                createdAt: -1
            });
        });

        test('should return 500 when task retrieval fails', async () => {
            Task.find.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    populate: jest.fn().mockReturnValue({
                        sort: jest.fn().mockRejectedValue(
                            new Error('Database unavailable')
                        )
                    })
                })
            });

            await getAssignedTasks(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('updateTaskStatus()', () => {
        let task;

        beforeEach(() => {
            task = {
                donation: 'donation-123',
                status: 'Accepted',
                save: jest.fn().mockResolvedValue(true)
            };

            Task.findOne.mockResolvedValue(task);
            Donation.findByIdAndUpdate.mockResolvedValue(true);
        });

        test('should return 404 when task is not assigned to volunteer', async () => {
            Task.findOne.mockResolvedValue(null);

            await updateTaskStatus(req, res);

            expect(Task.findOne).toHaveBeenCalledWith({
                _id: 'task-123',
                volunteer: 'volunteer-123'
            });
            expect(res.status).toHaveBeenCalledWith(404);
        });

        test('should update task status successfully', async () => {
            req.body = { status: 'Accepted' };

            await updateTaskStatus(req, res);

            expect(task.status).toBe('Accepted');
            expect(task.save).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(200);
        });

        test('should update quality check when food is picked up', async () => {
            await updateTaskStatus(req, res);

            expect(task.status).toBe('Picked Up');
            expect(task.qualityCheck).toEqual(req.body.qualityCheck);

            expect(Donation.findByIdAndUpdate).toHaveBeenCalledWith(
                'donation-123',
                { status: 'Picked Up' }
            );
        });

        test('should update donation status when task is delivered', async () => {
            req.body = { status: 'Delivered' };

            await updateTaskStatus(req, res);

            expect(Donation.findByIdAndUpdate).toHaveBeenCalledWith(
                'donation-123',
                { status: 'Delivered' }
            );
            expect(task.status).toBe('Delivered');
        });

        test('should return 500 when task update fails', async () => {
            task.save.mockRejectedValue(new Error('Database error'));

            req.body = { status: 'Accepted' };

            await updateTaskStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
});
