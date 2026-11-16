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
let environment;

beforeAll(async () => {
  environment = await startPerformanceEnvironment();
});

afterAll(async () => {
  await stopPerformanceEnvironment();
});

test('read-only API endpoints meet configurable light-traffic thresholds', async () => {
  const results = [];
  for (const endpoint of Object.values(ENDPOINTS)) {
    const raw = await runAutocannon(environment, endpoint, {
      connections: 1,
      durationSeconds: config.baselineSeconds,
    });
    results.push(summarizeResult(raw, endpoint, {
      connections: 1,
      durationSeconds: config.baselineSeconds,
    }));
  }

  const reportPath = await writeReport('baseline', {
    concurrency: 1,
    durationSecondsPerEndpoint: config.baselineSeconds,
    endpoints: results.map(result => result.path),
    thresholds: { maxP99Ms: config.maxP99Ms, maxErrorRatePct: config.maxErrorRatePct },
  }, results);
  printSummary('baseline', results, reportPath);

  const failures = failuresAgainstThresholds(results, config);
  expect(failures).toEqual([]);
});
