import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    // En desarrollo, /api se redirige al backend (npm run backend:dev), así el
    // frontend y la API comparten origen y no se necesita configurar CORS.
    proxy: {
      '/api': process.env.API_PROXY_DESTINO || 'http://localhost:3001',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/pruebas/preparacion.js',
    // Las pruebas de componentes usan el servicio en memoria (sin backend);
    // la integración con la API se prueba aparte (servicioApi.test.js y backend).
    env: { VITE_MODO_DEMO: 'true' },
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
