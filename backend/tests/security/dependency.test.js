const mongoose = require('mongoose');

function compareVersions(left, right) {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);

  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return Math.sign(difference);
  }

  return 0;
}

describe('Dependency security', () => {
  test('uses a patched Mongoose 8.x version (at least 8.24.7)', () => {
    expect(mongoose.version.split('.')[0]).toBe('8');
    expect(compareVersions(mongoose.version, '8.24.7')).toBeGreaterThanOrEqual(0);
  });
});
