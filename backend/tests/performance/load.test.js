const {
  ENDPOINTS,
  getPerformanceConfig,
  startPerformanceEnvironment,
  stopPerformanceEnvironment,
  runAutocannon,
  summarizeResult,
  writeReport,
  printSummary,
  failuresAgainstThresholds,
} = require('./helpers');

const config = getPerformanceConfig();
const workload = [ENDPOINTS.adminStats, ENDPOINTS.donorHistory, ENDPOINTS.volunteerTasks, ENDPOINTS.receiverUpcoming];
let environment;

beforeAll(async () => {
  environment = await startPerformanceEnvironment();
});

afterAll(async () => {
  await stopPerformanceEnvironment();
});

test('read-only API endpoints handle configurable normal concurrent traffic', async () => {
  const results = [];
  for (const endpoint of workload) {
    const runSettings = { connections: config.loadConnections, durationSeconds: config.loadSeconds };
    const raw = await runAutocannon(environment, endpoint, runSettings);
    results.push(summarizeResult(raw, endpoint, runSettings));
  }

  const reportPath = await writeReport('load', {
    concurrency: config.loadConnections,
    durationSecondsPerEndpoint: config.loadSeconds,
    endpoints: workload.map(endpoint => endpoint.path),
    thresholds: { maxP99Ms: config.maxP99Ms, maxErrorRatePct: config.maxErrorRatePct },
  }, results);
  printSummary('load', results, reportPath);

  const failures = failuresAgainstThresholds(results, config);
  expect(failures).toEqual([]);
});
