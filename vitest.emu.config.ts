import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { currentLane, viteEmulatorEnv } from './scripts/lane-ports.mjs';

// Repository tests against the emulators (auth + firestore). Run through `npm run test:rules`,
// which starts the emulators first. They share one emulator project, so files run one by one.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.emu.test.ts'],
    // The app code under test reads its emulator ports from these (lane in E2E_LANE).
    env: viteEmulatorEnv(currentLane()),
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    passWithNoTests: true,
  },
});
