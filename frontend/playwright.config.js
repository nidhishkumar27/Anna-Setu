const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5500',
    browserName: 'chromium',
    screenshot: 'only-on-failure',
  },
});
