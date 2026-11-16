import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

// En desarrollo el frontend llama a /api en su mismo origen y Vite lo reenvía al backend local:
// así el navegador no hace peticiones entre orígenes (sin CORS). En producción (GitHub Pages)
// no existe este servidor: se usa VITE_API_URL y CORS_ORIGENES del backend.
const BACKEND_LOCAL = process.env.VITE_PROXY_BACKEND || 'http://localhost:3001';
const proxyApi = {
  '/api': {
    target: BACKEND_LOCAL,
    changeOrigin: true,
    // /api/eventos es Server-Sent Events: la respuesta llega por partes y no debe comprimirse
    // ni guardarse en búfer, para que los avisos lleguen al instante.
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq, req) => {
        if (req.url.startsWith('/api/eventos')) proxyReq.setHeader('Accept-Encoding', 'identity');
      });
    },
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: proxyApi,
  },
  preview: {
    proxy: proxyApi,
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
