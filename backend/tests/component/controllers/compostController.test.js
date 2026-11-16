const CompostSale = require('../../../models/CompostSale');
const Donation = require('../../../models/Donation');
const {
  getCompostDonations,
  logCompostSale,
  getSalesHistory,
} = require('../../../controllers/compostController');
const { createResponse } = require('../helpers');

jest.mock('../../../models/CompostSale', () => {
  const MockCompostSale = jest.fn();
  MockCompostSale.find = jest.fn();
  return MockCompostSale;
});
jest.mock('../../../models/Donation', () => ({ find: jest.fn() }));

describe('Compost controller component', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { body: {} };
    res = createResponse();
    CompostSale.mockImplementation(function mockSale(data) {
      Object.assign(this, data);
      this.save = jest.fn().mockResolvedValue(this);
    });
  });

  test('queries compost donations with donor population and newest-first sorting', async () => {
    const donations = [{ type: 'compost' }];
    const sort = jest.fn().mockResolvedValue(donations);
    const populate = jest.fn().mockReturnValue({ sort });
    Donation.find.mockReturnValue({ populate });

    await getCompostDonations(req, res);

    expect(Donation.find).toHaveBeenCalledWith({ type: 'compost' });
    expect(populate).toHaveBeenCalledWith('donor', 'name');
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(donations);
  });

  test('returns a 500 response when compost donation retrieval fails', async () => {
    Donation.find.mockReturnValue({
      populate: jest.fn().mockReturnValue({ sort: jest.fn().mockRejectedValue(new Error('database detail')) }),
    });

    await getCompostDonations(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Server error.' }));
  });

  test('creates a sale from the supplied fields and returns the saved record', async () => {
    req.body = { buyerName: 'Community Kitchen', quantitySold: 12, revenue: 900 };

    await logCompostSale(req, res);

    expect(CompostSale).toHaveBeenCalledWith(req.body);
    expect(CompostSale.mock.instances[0].save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Compost sale logged successfully.',
      sale: expect.objectContaining(req.body),
    }));
  });

  test('returns a 500 response when sale persistence fails', async () => {
    CompostSale.mockImplementation(function mockSale(data) {
      Object.assign(this, data);
      this.save = jest.fn().mockRejectedValue(new Error('validation detail'));
    });

    await logCompostSale(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Server error.' }));
  });

  test('queries sale history sorted by sale date descending', async () => {
    const sales = [{ buyerName: 'Kitchen' }];
    const sort = jest.fn().mockResolvedValue(sales);
    CompostSale.find.mockReturnValue({ sort });

    await getSalesHistory(req, res);

    expect(CompostSale.find).toHaveBeenCalledWith();
    expect(sort).toHaveBeenCalledWith({ saleDate: -1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(sales);
  });

  test('returns a 500 response when sale history retrieval fails', async () => {
    CompostSale.find.mockReturnValue({ sort: jest.fn().mockRejectedValue(new Error('database detail')) });

    await getSalesHistory(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Server error.' }));
  });
});
