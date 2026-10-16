/**
 * Error de una operación de datos (API o servicio en memoria).
 * - status: código HTTP (0 = no se pudo conectar con el servidor).
 * - errores: detalle por campo cuando la API rechaza los datos (400).
 */
export class ErrorApi extends Error {
  constructor(status, mensaje, errores = null) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.status = status;
    this.errores = errores;
  }
}

/** Texto para mostrar al usuario: mensaje general + detalle por campo, si lo hay. */
export function mensajeDeError(error) {
  if (!error) return '';
  const detalle = error.errores ? Object.values(error.errores).filter(Boolean) : [];
  const base = error.message || 'Ocurrió un error inesperado.';
  return detalle.length > 0 ? `${base} ${detalle.join(' ')}` : base;
}
