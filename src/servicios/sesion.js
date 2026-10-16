/**
 * Sesión activa guardada en sessionStorage: { usuario, token }.
 * El token es el JWT de la API (null en modo demo, donde la sesión es local).
 */
export const CLAVE_SESION = 'aquachile_sesion_activa';

/** Evento que se emite cuando la API rechaza el token (vencido o inválido). */
export const EVENTO_SESION_EXPIRADA = 'aquachile:sesion-expirada';

export function leerSesion() {
  try {
    const crudo = sessionStorage.getItem(CLAVE_SESION);
    const sesion = crudo ? JSON.parse(crudo) : null;
    return sesion?.usuario ? sesion : null;
  } catch {
    return null;
  }
}

export function guardarSesion(sesion) {
  try {
    if (sesion) {
      sessionStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    } else {
      sessionStorage.removeItem(CLAVE_SESION);
    }
  } catch {
    // Si sessionStorage no está disponible, la sesión vive solo en memoria
  }
}

export function leerToken() {
  return leerSesion()?.token ?? null;
}
