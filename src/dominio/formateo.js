/** Formatea una fecha ISO (yyyy-mm-dd) a formato chileno legible dd-mm-yyyy. */
export function formatearFecha(fecha) {
  if (!fecha) return '—';
  const [anio, mes, dia] = String(fecha).slice(0, 10).split('-');
  if (!anio || !mes || !dia) return String(fecha);
  return `${dia}-${mes}-${anio}`;
}

/**
 * Tiempo desde una fecha de la BD ("2026-11-04 10:00:00", en UTC): "hace 5 min", "hace 2 h"…
 * Desde los 7 días muestra la fecha.
 */
export function tiempoTranscurrido(fechaBd, ahora = new Date()) {
  const fecha = new Date(`${String(fechaBd).replace(' ', 'T')}Z`);
  if (Number.isNaN(fecha.getTime())) return '';
  const minutos = Math.floor((ahora - fecha) / 60000);
  if (minutos < 1) return 'hace un momento';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
  return formatearFecha(fecha.toISOString());
}
