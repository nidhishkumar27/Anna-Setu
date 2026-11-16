const Donation = require('../../models/Donation');
const {
    createDonation,
    getDonationHistory
} = require('../../controllers/donorController');

jest.mock('../../models/Donation', () => {
    const MockDonation = jest.fn();
    MockDonation.find = jest.fn();
    return MockDonation;
});

describe('WHITE-BOX TESTING: Donor Controller', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();

        req = {
            user: { id: 'donor-123' },
            body: {
                type: 'human',
                description: 'Fresh food packets',
                quantity: 20,
                pickupAddress: 'Bengaluru',
                additionalGuidelines: 'Handle carefully'
            }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        Donation.mockImplementation(function(data) {
            Object.assign(this, data);
            this.save = jest.fn().mockResolvedValue(this);
        });
    });

    describe('createDonation()', () => {
        test('should create a donation successfully', async () => {
            await createDonation(req, res);

            expect(Donation).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(201);
        });

        test('should associate the donation with the authenticated donor', async () => {
            await createDonation(req, res);

            expect(Donation.mock.instances[0].donor).toBe('donor-123');
        });

        test('should pass all donation details to the model', async () => {
            await createDonation(req, res);

            expect(Donation).toHaveBeenCalledWith(expect.objectContaining({
                donor: 'donor-123',
                type: 'human',
                description: 'Fresh food packets',
                quantity: 20,
                pickupAddress: 'Bengaluru',
                additionalGuidelines: 'Handle carefully'
            }));
        });

        test('should return the saved donation in the response', async () => {
            await createDonation(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Donation scheduled successfully!'
            }));
        });

        test('should return 500 when saving a donation fails', async () => {
            Donation.mockImplementationOnce(function(data) {
                Object.assign(this, data);
                this.save = jest.fn().mockRejectedValue(
                    new Error('Database error')
                );
            });

            await createDonation(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Server error.'
            }));
        });
    });

    describe('getDonationHistory()', () => {
        test('should retrieve donations belonging to the logged-in donor', async () => {
            const donations = [{ _id: 'donation-1' }];

            const sortMock = jest.fn().mockResolvedValue(donations);
            const populateMock = jest.fn().mockReturnValue({
                sort: sortMock
            });

            Donation.find.mockReturnValue({
                populate: populateMock
            });

            await getDonationHistory(req, res);

            expect(Donation.find).toHaveBeenCalledWith({
                donor: 'donor-123'
            });
            expect(res.status).toHaveBeenCalledWith(200);
        });

        test('should populate assigned volunteer name and phone', async () => {
            const populateMock = jest.fn().mockReturnValue({
                sort: jest.fn().mockResolvedValue([])
            });

            Donation.find.mockReturnValue({
                populate: populateMock
            });

            await getDonationHistory(req, res);

            expect(populateMock).toHaveBeenCalledWith(
                'assignedVolunteer',
                'name phone'
            );
        });

        test('should sort donation history by newest first', async () => {
            const sortMock = jest.fn().mockResolvedValue([]);
            const populateMock = jest.fn().mockReturnValue({
                sort: sortMock
            });

            Donation.find.mockReturnValue({
                populate: populateMock
            });

            await getDonationHistory(req, res);

            expect(sortMock).toHaveBeenCalledWith({
                createdAt: -1
            });
        });

        test('should return 500 when history retrieval fails', async () => {
            Donation.find.mockReturnValue({
                populate: jest.fn().mockReturnValue({
                    sort: jest.fn().mockRejectedValue(
                        new Error('Database unavailable')
                    )
                })
            });

            await getDonationHistory(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Server error.'
            }));
        });
    });
});

