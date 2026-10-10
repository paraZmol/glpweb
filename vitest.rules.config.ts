import { defineConfig } from 'vitest/config';

// Security-rules tests. Run through `npm run test:rules`, which starts the emulators first.
export default defineConfig({
  test: {
    include: ['firebase/tests/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
