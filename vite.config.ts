import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // tests/scripts holds the tests of the local scripts that need no emulator.
    include: ['src/**/*.test.{ts,tsx}', 'tests/scripts/**/*.test.ts'],
    // Repository tests need the emulators: they run with vitest.emu.config.ts.
    exclude: ['**/*.emu.test.ts'],
  },
});
