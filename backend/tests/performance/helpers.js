const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');
const autocannon = require('autocannon');

let mongod;
let databaseDir;
let mongoose;
let httpServer;
let savedJwtSecret;
let testJwtSecret;
let runningEnvironment;
const testDataDir = path.join(__dirname, '..', '..', 'test-data');

function debugPerformance(message) {
  if (process.env.PERF_DEBUG === '1') console.log(`[performance:debug] ${message}`);
}

const ENDPOINTS = Object.freeze({
  root: Object.freeze({ name: 'public-root', path: '/', role: null, expectedStatus: 200 }),
  adminStats: Object.freeze({ name: 'admin-stats', path: '/api/admin/stats', role: 'admin', expectedStatus: 200 }),
  adminActivity: Object.freeze({ name: 'admin-activity', path: '/api/admin/activity', role: 'admin', expectedStatus: 200 }),
  donorHistory: Object.freeze({ name: 'donor-history', path: '/api/donor', role: 'donor', expectedStatus: 200 }),
  volunteerTasks: Object.freeze({ name: 'volunteer-tasks', path: '/api/volunteer/tasks', role: 'volunteer', expectedStatus: 200 }),
  volunteerStats: Object.freeze({ name: 'volunteer-stats', path: '/api/volunteer/stats', role: 'volunteer', expectedStatus: 200 }),
  receiverUpcoming: Object.freeze({ name: 'receiver-upcoming-deliveries', path: '/api/receiver/deliveries/upcoming', role: 'receiver', expectedStatus: 200 }),
  receiverHistory: Object.freeze({ name: 'receiver-delivery-history', path: '/api/receiver/deliveries/history', role: 'receiver', expectedStatus: 200 }),
});

function readInt(name, fallback, min, max) {
  const raw = process.env[name];
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function readNumber(name, fallback, min, max) {
  const raw = process.env[name];
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be a number between ${min} and ${max}.`);
  }
  return value;
}

function getPerformanceConfig() {
  const stressLevels = (process.env.PERF_STRESS_LEVELS || '5,10,20')
    .split(',')
    .map(value => Number(value.trim()));
  if (stressLevels.length < 1 || stressLevels.length > 4 || stressLevels.some(value => !Number.isInteger(value) || value < 1 || value > 100)) {
    throw new Error('PERF_STRESS_LEVELS must contain 1–4 comma-separated integers between 1 and 100.');
  }

  return {
    baselineSeconds: readInt('PERF_BASELINE_SECONDS', 2, 1, 3),
    loadSeconds: readInt('PERF_LOAD_SECONDS', 3, 1, 4),
    loadConnections: readInt('PERF_LOAD_CONNECTIONS', 10, 1, 50),
    stressSeconds: readInt('PERF_STRESS_SECONDS', 2, 1, 3),
    stressLevels,
    fixtureRecords: readInt('PERF_FIXTURE_RECORDS', 20, 1, 250),
    maxP99Ms: readNumber('PERF_MAX_P99_MS', 3000, 1, 120000),
    maxErrorRatePct: readNumber('PERF_MAX_ERROR_RATE_PCT', 1, 0, 100),
    stressMaxP99Ms: readNumber('PERF_STRESS_MAX_P99_MS', 5000, 1, 120000),
    stressMaxErrorRatePct: readNumber('PERF_STRESS_MAX_ERROR_RATE_PCT', 5, 0, 100),
  };
}

async function seedFixtureData() {
  const User = require('../../models/User');
  const Donation = require('../../models/Donation');
  const Task = require('../../models/Task');
  const Activity = require('../../models/Activity');

  const password = `perf-fixture-${randomUUID()}`;
  const users = await User.create([
    { name: 'Performance Admin', email: `perf-admin-${randomUUID()}@example.test`, password, role: 'admin', status: 'approved' },
    { name: 'Performance Donor', email: `perf-donor-${randomUUID()}@example.test`, password, role: 'donor', donorType: 'instant', status: 'approved' },
    { name: 'Performance Volunteer', email: `perf-volunteer-${randomUUID()}@example.test`, password, role: 'volunteer', status: 'approved' },
    { name: 'Performance Receiver', email: `perf-receiver-${randomUUID()}@example.test`, password, role: 'receiver', status: 'approved' },
  ]);
  const [admin, donor, volunteer, receiver] = users;
  const recordCount = getPerformanceConfig().fixtureRecords;

  const donations = await Donation.insertMany(Array.from({ length: recordCount }, (_, index) => ({
    donor: donor._id,
    type: index % 2 === 0 ? 'human' : 'animal',
    description: `Performance fixture donation ${index + 1}`,
    quantity: 5 + (index % 20),
    pickupAddress: `${index + 1} Performance Test Road`,
    status: 'Assigned',
    assignedVolunteer: volunteer._id,
  })));

  const taskStatuses = ['Accepted', 'Picked Up', 'Delivered', 'Completed'];
  await Task.insertMany(donations.map((donation, index) => ({
    donation: donation._id,
    volunteer: volunteer._id,
    receiver: receiver._id,
    status: taskStatuses[index % taskStatuses.length],
    ...(taskStatuses[index % taskStatuses.length] === 'Picked Up'
      ? { qualityCheck: { foodQuality: 'Good', packaging: 'Good', remarks: 'Synthetic performance fixture.' } }
      : {}),
  })));

  await Activity.insertMany(Array.from({ length: Math.min(recordCount, 20) }, (_, index) => ({
    text: `Synthetic performance activity ${index + 1}`,
    type: 'task_assigned',
    userRef: donor._id,
  })));

  const jwt = require('jsonwebtoken');
  const tokenFor = user => jwt.sign(
    { id: user._id.toString(), role: user.role },
    testJwtSecret,
    { expiresIn: '30m' },
  );

  return {
    tokens: {
      admin: tokenFor(admin),
      donor: tokenFor(donor),
      volunteer: tokenFor(volunteer),
      receiver: tokenFor(receiver),
    },
  };
}

async function waitForServer(baseUrl, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(500) });
      await response.arrayBuffer();
      if (response.status === 200) return;
      lastError = new Error(`Readiness endpoint returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Performance test server did not become ready: ${lastError?.message || 'timeout'}`);
}

async function startPerformanceEnvironment() {
  if (runningEnvironment) return runningEnvironment;

  savedJwtSecret = process.env.JWT_SECRET;
  testJwtSecret = randomBytes(32).toString('hex');
  process.env.JWT_SECRET = testJwtSecret;
  fs.mkdirSync(testDataDir, { recursive: true });
  databaseDir = fs.mkdtempSync(path.join(testDataDir, `performance-mongo-${process.pid}-`));

  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoose = require('mongoose');
    debugPerformance(`starting MongoDB at ${databaseDir}`);
    mongod = new MongoMemoryServer({ instance: { dbPath: databaseDir } });
    await mongod.start();
    debugPerformance('MongoDB started; connecting Mongoose');
    await mongoose.connect(mongod.getUri(), { serverSelectionTimeoutMS: 5000 });

    debugPerformance('Mongoose connected; creating synthetic fixtures');
    const fixtures = await seedFixtureData();
    debugPerformance('fixtures created; loading Express app and binding loopback server');
    const app = require('../../app');
    httpServer = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      httpServer.once('listening', resolve);
      httpServer.once('error', reject);
    });

    const address = httpServer.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    debugPerformance(`Express listening at ${baseUrl}; waiting for readiness`);
    await waitForServer(baseUrl);

    debugPerformance('readiness confirmed');
    runningEnvironment = { baseUrl, tokens: fixtures.tokens };
    return runningEnvironment;
  } catch (error) {
    await stopPerformanceEnvironment();
    throw error;
  }
}

async function stopPerformanceEnvironment() {
  let cleanupError;
  if (httpServer) {
    try {
      httpServer.closeAllConnections?.();
      await new Promise((resolve, reject) => httpServer.close(error => error ? reject(error) : resolve()));
    } catch (error) {
      cleanupError = error;
    }
    httpServer = undefined;
  }
  if (mongoose && mongoose.connection.readyState !== 0) {
    try {
      await mongoose.disconnect();
    } catch (error) {
      cleanupError ||= error;
    }
  }
  if (mongod) {
    try {
      await mongod.stop({ doCleanup: true });
    } catch (error) {
      cleanupError ||= error;
    }
    mongod = undefined;
  }
  // MongoMemoryServer owns dbPath cleanup when stopped with doCleanup:true.
  // Do not race Windows file handles with a second recursive removal here.
  databaseDir = undefined;
  if (savedJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = savedJwtSecret;
  savedJwtSecret = undefined;
  testJwtSecret = undefined;
  mongoose = undefined;
  runningEnvironment = undefined;
  if (cleanupError) throw cleanupError;
}

function runAutocannon(environment, endpoint, { connections, durationSeconds }) {
  if (!endpoint || !Object.values(ENDPOINTS).includes(endpoint)) {
    throw new Error('Refusing to benchmark an endpoint outside the audited local endpoint list.');
  }
  const target = new URL(endpoint.path, environment.baseUrl);
  if (target.hostname !== '127.0.0.1') {
    throw new Error(`Refusing non-local performance target ${target.hostname}.`);
  }
  const headers = endpoint.role
    ? { Authorization: `Bearer ${environment.tokens[endpoint.role]}` }
    : {};

  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (error, result) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve(result);
    };

    const instance = autocannon({
      url: target.toString(),
      method: 'GET',
      headers,
      connections,
      duration: durationSeconds,
      pipelining: 1,
      title: `Anna-Setu performance ${endpoint.name}`,
    }, done);
    instance.on('error', error => done(error));
  });
}

function summarizeResult(result, endpoint, runSettings) {
  const statusCodes = Object.fromEntries(Object.entries(result.statusCodeStats || {})
    .map(([status, stats]) => [status, Number(stats.count) || 0]));
  const responseCount = Object.values(statusCodes).reduce((total, count) => total + count, 0);
  const expectedCount = statusCodes[String(endpoint.expectedStatus)] || 0;
  const unexpectedStatuses = Object.fromEntries(Object.entries(statusCodes)
    .filter(([status]) => status !== String(endpoint.expectedStatus)));
  const unexpectedStatusCount = Object.values(unexpectedStatuses).reduce((total, count) => total + count, 0);
  const transportErrors = ['errors', 'timeouts', 'resets', 'mismatches']
    .reduce((total, key) => total + (Number(result[key]) || 0), 0);
  const totalRequests = Number(result.requests?.total) || (responseCount + transportErrors);
  const failedRequests = unexpectedStatusCount + transportErrors;
  const errorRatePct = totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 100;

  const classifiedUnexpectedResponses = Object.entries(unexpectedStatuses).map(([status, count]) => ({
    status: Number(status),
    count,
    category: status === '401' || status === '403'
      ? 'authentication-or-authorization-configuration'
      : status === '429'
        ? 'rate-limited'
        : Number(status) >= 500
          ? 'application-error'
          : 'unexpected-client-or-protocol-response',
  }));

  return {
    endpoint: endpoint.name,
    method: 'GET',
    path: endpoint.path,
    expectedStatus: endpoint.expectedStatus,
    connections: runSettings.connections,
    durationSeconds: runSettings.durationSeconds,
    totalRequests,
    statusCodes,
    unexpectedResponses: classifiedUnexpectedResponses,
    networkErrors: Number(result.errors) || 0,
    timeouts: Number(result.timeouts) || 0,
    resets: Number(result.resets) || 0,
    failedRequests,
    errorRatePct: Number(errorRatePct.toFixed(4)),
    latencyMs: {
      average: Number(result.latency?.average) || 0,
      p50: Number(result.latency?.p50) || 0,
      p97_5: Number(result.latency?.p97_5) || 0,
      p99: Number(result.latency?.p99) || 0,
      max: Number(result.latency?.max) || 0,
    },
    requestsPerSecond: Number(result.requests?.average) || 0,
    throughputBytesPerSecond: Number(result.throughput?.average) || 0,
  };
}

async function writeReport(suite, runConfig, results) {
  const configuredDir = process.env.PERF_REPORT_DIR;
  const reportDir = configuredDir
    ? path.resolve(process.cwd(), configuredDir)
    : path.join(__dirname, 'reports');
  await fs.promises.mkdir(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `${suite}.json`);
  const report = {
    suite,
    generatedAt: new Date().toISOString(),
    target: '127.0.0.1 (in-process Express server)',
    database: 'isolated MongoMemoryServer; synthetic fixture data only',
    runConfig,
    results,
  };
  await fs.promises.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return reportPath;
}

function printSummary(suite, results, reportPath) {
  const table = results.map(result => ({
    endpoint: result.endpoint,
    connections: result.connections,
    rps: Number(result.requestsPerSecond.toFixed(1)),
    avgMs: Number(result.latencyMs.average.toFixed(2)),
    p99Ms: Number(result.latencyMs.p99.toFixed(2)),
    errors: result.failedRequests,
    errorPct: result.errorRatePct,
  }));
  console.log(`[performance:${suite}] ${JSON.stringify(table)}`);
  console.log(`[performance:${suite}] report: ${reportPath}`);
}

function failuresAgainstThresholds(results, { maxP99Ms, maxErrorRatePct }) {
  return results.flatMap(result => {
    const failures = [];
    if (result.failedRequests > 0) failures.push(`${result.endpoint}: ${result.failedRequests} failed/non-expected responses`);
    if (result.errorRatePct > maxErrorRatePct) failures.push(`${result.endpoint}: error rate ${result.errorRatePct}% exceeds ${maxErrorRatePct}%`);
    if (result.latencyMs.p99 > maxP99Ms) failures.push(`${result.endpoint}: p99 ${result.latencyMs.p99} ms exceeds ${maxP99Ms} ms`);
    return failures;
  });
}

module.exports = {
  ENDPOINTS,
  getPerformanceConfig,
  startPerformanceEnvironment,
  stopPerformanceEnvironment,
  runAutocannon,
  summarizeResult,
  writeReport,
  printSummary,
  failuresAgainstThresholds,
};
