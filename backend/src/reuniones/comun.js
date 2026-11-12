/**
 * Piezas comunes de los proveedores de reuniones online (Google Calendar y Microsoft Graph).
 */

/** Zona horaria de las entrevistas: la hora que se agenda es la hora de Chile continental. */
const ZONA_HORARIA = 'America/Santiago';
/** Duración por defecto de la entrevista psicolaboral, en minutos. */
const DURACION_MINUTOS = 60;

/** Enlaces de reunión aceptados: Google Meet y Microsoft Teams, siempre por https. */
const DOMINIOS_REUNION = ['meet.google.com', 'teams.microsoft.com', 'teams.live.com'];

/**
 * Valida un enlace de reunión pegado a mano. Devuelve el enlace normalizado o null si no es
 * una URL https:// de Meet o de Teams.
 */
function validarEnlaceReunion(valor) {
  if (typeof valor !== 'string' || !valor.trim() || valor.length > 2000) return null;
  let url;
  try {
    url = new URL(valor.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const permitido = DOMINIOS_REUNION.some((dominio) => host === dominio || host.endsWith(`.${dominio}`));
  return permitido ? url.toString() : null;
}

/** Suma minutos a una fecha y hora locales ("2026-12-01", "10:30") sin pasar por la zona del servidor. */
function sumarMinutos(fecha, hora, minutos) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const [horas, mins] = hora.split(':').map(Number);
  const instante = new Date(Date.UTC(anio, mes - 1, dia, horas, mins + minutos));
  return instante.toISOString().slice(0, 19);
}

/** Inicio y término de la entrevista en hora local ("2026-12-01T10:30:00"), para la zona de Chile. */
function horario(fecha, hora, duracion = DURACION_MINUTOS) {
  return { inicio: `${fecha}T${hora}:00`, termino: sumarMinutos(fecha, hora, duracion) };
}

/** Error de un proveedor de reuniones. `sinPermiso` indica que falta autorizar el calendario. */
class ErrorReunion extends Error {
  constructor(mensaje, { status = 502, sinPermiso = false } = {}) {
    super(mensaje);
    this.name = 'ErrorReunion';
    this.status = status;
    this.sinPermiso = sinPermiso;
  }
}

module.exports = { ZONA_HORARIA, DURACION_MINUTOS, ErrorReunion, horario, validarEnlaceReunion };
