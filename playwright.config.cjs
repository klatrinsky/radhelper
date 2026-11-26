const { defineConfig } = require('@playwright/test');

const baseURL = 'http://127.0.0.1:4180';

module.exports = defineConfig({
  testDir: './tests/browser',
  workers: process.env.CI ? 1 : undefined,
  use: { baseURL, browserName: 'chromium' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    {
      name: 'mobile',
      use: { viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: 'python3 -m http.server 4180 --bind 127.0.0.1',
    url: baseURL,
    stderr: 'ignore',
  },
});
