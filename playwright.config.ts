import { defineConfig, devices } from '@playwright/test';

// Parallel agents each use their own lane (E2E_LANE=1..9) so runs never share a port or output.
const lane = Number(process.env.E2E_LANE ?? 0);
const port = 4173 + lane;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: lane ? `test-results-${lane}` : 'test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  use: {
    baseURL,
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'movil', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    {
      name: 'escritorio',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort --host 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
