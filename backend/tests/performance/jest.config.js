const path = require('node:path');

module.exports = {
  rootDir: path.resolve(__dirname, '../..'),
  testEnvironment: 'node',
  testTimeout: 30000,
  testMatch: ['<rootDir>/tests/performance/**/*.test.js'],
  maxWorkers: 1,
};
