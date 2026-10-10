import { defineConfig, devices } from '@playwright/test';
import { currentLane, lanePorts } from './scripts/lane-ports.mjs';

// Parallel agents each use their own lane (E2E_LANE=1..9): preview port, emulator ports and
// output folder all follow the same number, so runs never share anything.
const lane = currentLane();
const port = lanePorts(lane).preview;
const baseURL = `http://127.0.0.1:${port}`;

// E2E_EMULATORS=true serves a build that talks to the emulators of this lane, already seeded
// (tests/seed). Flows that sign in or read data need it; the public smoke test does not.
const withEmulators = process.env.E2E_EMULATORS === 'true';
const serve = `npm run build && npm run preview -- --port ${port} --strictPort --host 127.0.0.1`;
const serveWithEmulators = `node scripts/emulators.mjs exec --only auth,firestore,database -- "npm run seed && ${serve}"`;

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
    command: withEmulators ? serveWithEmulators : serve,
    // The launcher adds the emulator ports of the lane to the build's environment.
    env: withEmulators ? { VITE_USE_EMULATORS: 'true' } : {},
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: withEmulators ? 240_000 : 120_000,
  },
});
