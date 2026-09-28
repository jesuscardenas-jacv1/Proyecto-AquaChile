/** Formatea una fecha ISO (yyyy-mm-dd) a formato chileno legible dd-mm-yyyy. */
export function formatearFecha(fecha) {
  if (!fecha) return '—';
  const [anio, mes, dia] = String(fecha).slice(0, 10).split('-');
  if (!anio || !mes || !dia) return String(fecha);
  return `${dia}-${mes}-${anio}`;
}
