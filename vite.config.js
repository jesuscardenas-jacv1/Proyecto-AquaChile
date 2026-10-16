import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/pruebas/preparacion.js',
    // El backend tiene sus propias pruebas con node:test.
    exclude: [...configDefaults.exclude, 'backend/**'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './cobertura',
      include: ['src/**/*.jsx', 'src/**/*.js'],
      exclude: ['src/main.jsx', 'src/pruebas/**', '**/*.test.{js,jsx}'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
