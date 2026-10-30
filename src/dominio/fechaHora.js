/**
 * Reglas de fecha y hora para los selectores de rueda de la agenda.
 * Trabaja con cadenas ISO (yyyy-mm-dd y HH:MM) para que coincidan con la API.
 */

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const dosDigitos = (numero) => String(numero).padStart(2, '0');

/** Cantidad de días de un mes (mes de 1 a 12). */
export function diasDelMes(anio, mes) {
  return new Date(anio, mes, 0).getDate();
}

/** Separa "yyyy-mm-dd" en partes numéricas, o devuelve null si no es válida. */
export function descomponerFecha(iso) {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!coincidencia) return null;
  return { anio: Number(coincidencia[1]), mes: Number(coincidencia[2]), dia: Number(coincidencia[3]) };
}

/** Arma "yyyy-mm-dd" ajustando el día si el mes es más corto. */
export function componerFecha({ anio, mes, dia }) {
  const diaAjustado = Math.min(dia, diasDelMes(anio, mes));
  return `${anio}-${dosDigitos(mes)}-${dosDigitos(diaAjustado)}`;
}

/** Separa "HH:MM" en horas y minutos, o devuelve null si no es válida. */
export function descomponerHora(hora) {
  const coincidencia = /^(\d{2}):(\d{2})$/.exec(hora ?? '');
  if (!coincidencia) return null;
  return { hora: Number(coincidencia[1]), minuto: Number(coincidencia[2]) };
}

export function componerHora({ hora, minuto }) {
  return `${dosDigitos(hora)}:${dosDigitos(minuto)}`;
}

/** Texto legible para el resumen: "miércoles 20 de octubre de 2026". */
export function textoFecha(iso) {
  const partes = descomponerFecha(iso);
  if (!partes) return 'Sin fecha seleccionada';
  const fecha = new Date(partes.anio, partes.mes - 1, partes.dia);
  return fecha.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
