import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  // jsdom no implementa el desplazamiento de la ventana (lo usa ScrollAlInicio).
  window.scrollTo = vi.fn();
  // Cada prueba parte de un localStorage vacío para no arrastrar datos.
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
