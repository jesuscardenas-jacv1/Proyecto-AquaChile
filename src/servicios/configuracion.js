import { cargarDatos } from '../datos/almacen';
import { crearServicioApi } from './servicioApi';
import { crearServicioMemoria } from './servicioMemoria';

/**
 * Modo de datos de la aplicación (variables de entorno de Vite, ver .env.example):
 * - 'api'  (por defecto): usa la API REST del backend. URL en VITE_API_URL
 *   (por defecto '/api', que en desarrollo Vite redirige a http://localhost:3001).
 * - 'demo' (VITE_MODO_DEMO=true): datos simulados en el navegador (localStorage) y
 *   login local, sin backend. Es el modo de la versión publicada en GitHub Pages.
 */
export const MODO_DATOS = import.meta.env.VITE_MODO_DEMO === 'true' ? 'demo' : 'api';

export const URL_API = import.meta.env.VITE_API_URL || '/api';

/** Crea el servicio de datos que corresponde al modo configurado. */
export function crearServicioPorDefecto() {
  if (MODO_DATOS === 'demo') {
    return crearServicioMemoria(cargarDatos(), { persistir: true });
  }
  return crearServicioApi({ urlBase: URL_API });
}
