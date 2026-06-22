import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // Match Next's automatic JSX runtime so components render in tests without importing React.
  esbuild: { jsx: 'automatic' },
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
