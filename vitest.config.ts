import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { 'react-native': 'react-native-web' },
  },
  test: {
    include: ['packages/**/*.test.{ts,tsx}', 'apps/doctor/src/**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
