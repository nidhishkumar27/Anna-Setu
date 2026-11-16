// tests/setup.js — Shared in-memory MongoDB setup for all test suites
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

let mongod;
const testDataDir = path.join(__dirname, '..', 'test-data');
let databaseDir;

/**
 * Start an in-memory MongoDB instance and connect Mongoose to it.
 */
async function connect() {
  fs.mkdirSync(testDataDir, { recursive: true });
  databaseDir = fs.mkdtempSync(path.join(testDataDir, 'mongo-'));
  try {
    mongod = await MongoMemoryServer.create({
      instance: { dbPath: databaseDir },
    });
    const uri = mongod.getUri();
    await mongoose.connect(uri);
  } catch (error) {
    if (mongod) {
      await mongod.stop({ doCleanup: true });
      mongod = undefined;
    }
    databaseDir = undefined;
    throw error;
  }
}

/**
 * Drop the database and disconnect after each suite.
 */
async function closeDatabase() {
  try {
    if (mongoose.connection.readyState !== 0) {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.dropDatabase();
      }
      await mongoose.connection.close();
    }
  } finally {
    if (mongod) {
      await mongod.stop({ doCleanup: true });
      mongod = undefined;
    }
    databaseDir = undefined;
  }
}

/**
 * Clear all collections between tests.
 */
async function clearDatabase() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

module.exports = { connect, closeDatabase, clearDatabase };
