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
// Test builds NEVER go to dist/, the folder Hosting deploys (PLAN 2.11): a build that points at
// the emulators left there by a test run could be published by the next deploy. Each lane
// builds into its own dist-e2e-<lane>, ignored by git, and serves from it.
const outDir = `dist-e2e-${lane}`;
const build = `npm run types && npx vite build --outDir ${outDir} --emptyOutDir`;
const preview = `npx vite preview --outDir ${outDir} --port ${port} --strictPort --host 127.0.0.1`;
const serve = `${build} && ${preview}`;
const serveWithEmulators = `node scripts/emulators.mjs exec --only auth,firestore,database -- "npm run seed && ${serve}"`;

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: lane ? `test-results-${lane}` : 'test-results',
  // Every wait is on what the screen shows; this is only how long to keep looking. The first
  // tests of a run start one browser per worker at the same moment, each loading the app cold:
  // on a busy machine the first screen with data can take longer than the default 5 s.
  expect: { timeout: 15_000 },
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
    // VITE_E2E_SIGN_IN puts the test-only sign-in entry in this build (PLAN 2.1): it only works
    // against the Auth emulator, and `scripts/check-dist.mjs` keeps it out of what is deployed.
    env: withEmulators ? { VITE_USE_EMULATORS: 'true', VITE_E2E_SIGN_IN: 'true' } : {},
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: withEmulators ? 240_000 : 120_000,
  },
});
