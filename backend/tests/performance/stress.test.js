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
const workload = [ENDPOINTS.root, ENDPOINTS.adminStats];
let environment;

beforeAll(async () => {
  environment = await startPerformanceEnvironment();
});

afterAll(async () => {
  await stopPerformanceEnvironment();
});

test('read-only API endpoints tolerate bounded stepped concurrency', async () => {
  const results = [];
  for (const connections of config.stressLevels) {
    for (const endpoint of workload) {
      const runSettings = { connections, durationSeconds: config.stressSeconds };
      const raw = await runAutocannon(environment, endpoint, runSettings);
      results.push(summarizeResult(raw, endpoint, runSettings));
    }
  }

  const reportPath = await writeReport('stress', {
    concurrencyLevels: config.stressLevels,
    durationSecondsPerEndpointAndLevel: config.stressSeconds,
    endpoints: workload.map(endpoint => endpoint.path),
    thresholds: {
      maxP99Ms: config.stressMaxP99Ms,
      maxErrorRatePct: config.stressMaxErrorRatePct,
    },
  }, results);
  printSummary('stress', results, reportPath);

  const failures = failuresAgainstThresholds(results, {
    maxP99Ms: config.stressMaxP99Ms,
    maxErrorRatePct: config.stressMaxErrorRatePct,
  });
  expect(failures).toEqual([]);
});
