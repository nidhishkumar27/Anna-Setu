const CompostSale = require('../../../models/CompostSale');

describe('CompostSale model component', () => {
  test('trims buyer name and defaults sale date', () => {
    const before = Date.now();
    const sale = new CompostSale({ buyerName: '  Local Garden  ', quantitySold: 10, revenue: 500 });
    const after = Date.now();

    expect(sale.buyerName).toBe('Local Garden');
    expect(sale.saleDate.getTime()).toBeGreaterThanOrEqual(before);
    expect(sale.saleDate.getTime()).toBeLessThanOrEqual(after);
    expect(sale.validateSync()).toBeUndefined();
  });

  test('requires buyer name, quantity sold, and revenue', () => {
    const error = new CompostSale({}).validateSync();

    expect(Object.keys(error.errors)).toEqual(expect.arrayContaining(['buyerName', 'quantitySold', 'revenue']));
  });

  test('rejects nonnumeric sale quantity and revenue', () => {
    const error = new CompostSale({ buyerName: 'Local Garden', quantitySold: 'many', revenue: 'unknown' }).validateSync();

    expect(error.errors.quantitySold).toBeDefined();
    expect(error.errors.revenue).toBeDefined();
  });
});
