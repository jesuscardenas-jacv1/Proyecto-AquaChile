import { datosSemilla } from './semilla';

export const CLAVE_ALMACEN = 'aquachile_psicodelivery_v2';

const COLECCIONES = ['candidatos', 'solicitudes', 'evaluaciones'];

function clonarSemilla() {
  return JSON.parse(JSON.stringify(datosSemilla));
}

/** Devuelve una copia de la semilla para no mutar los datos originales. */
export function obtenerSemilla() {
  return clonarSemilla();
}

/**
 * Lee los datos guardados en localStorage.
 * Si no existen o estan corruptos devuelve los datos semilla (modo demo).
 */
export function cargarDatos(almacen = window.localStorage) {
  try {
    const crudo = almacen.getItem(CLAVE_ALMACEN);
    if (!crudo) return obtenerSemilla();
    const guardados = JSON.parse(crudo);
    if (!guardados || typeof guardados !== 'object') return obtenerSemilla();

    const datos = { ...obtenerSemilla() };
    COLECCIONES.forEach((coleccion) => {
      if (Array.isArray(guardados[coleccion])) {
        datos[coleccion] = guardados[coleccion];
      }
    });
    return datos;
  } catch (error) {
    return obtenerSemilla();
  }
}

/** Persiste el estado actual. Los errores de cuota se ignoran a proposito. */
export function guardarDatos(datos, almacen = window.localStorage) {
  try {
    almacen.setItem(CLAVE_ALMACEN, JSON.stringify(datos));
    return true;
  } catch (error) {
    return false;
  }
}

/** Genera el siguiente id correlativo de una coleccion. */
export function generarId(coleccion) {
  const ids = coleccion.map((item) => Number(item.id) || 0);
  return ids.length === 0 ? 1 : Math.max(...ids) + 1;
}
