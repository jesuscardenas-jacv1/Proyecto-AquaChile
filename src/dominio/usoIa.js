/** Formato del consumo de IA para el panel del administrador. */

export const NOMBRES_TAREA = {
  analizarCv: 'Análisis de CV',
  extraerDatosCv: 'Autocompletar desde CV',
  redactarOferta: 'Redactar oferta',
  borradorEvaluacion: 'Borrador de evaluación',
  notasEntrevista: 'Notas de la entrevista',
  transcripcion: 'Transcripción de audio',
};

export const nombreTarea = (tarea) => NOMBRES_TAREA[tarea] ?? tarea;

const numero = new Intl.NumberFormat('es-CL');

/** Número con formato chileno (coma decimal). */
export const formatearNumero = (valor = 0) => numero.format(valor);

/** "USD 0,0812": con 4 decimales bajo 1 dólar, porque cada llamada cuesta centavos. */
export function formatearUsd(valor = 0) {
  const decimales = Math.abs(valor) < 1 ? 4 : 2;
  return `USD ${new Intl.NumberFormat('es-CL', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(valor)}`;
}

/** "12,3 mil" o "1,2 M" para cifras de tokens. */
export function formatearTokens(valor = 0) {
  if (valor >= 1_000_000) return `${numero.format(Math.round(valor / 100_000) / 10)} M`;
  if (valor >= 10_000) return `${numero.format(Math.round(valor / 100) / 10)} mil`;
  return numero.format(valor);
}

/** "3 min 20 s" a partir de segundos de audio. */
export function formatearDuracion(segundos = 0) {
  const total = Math.round(segundos);
  const minutos = Math.floor(total / 60);
  if (!minutos) return `${total} s`;
  return total % 60 ? `${minutos} min ${total % 60} s` : `${minutos} min`;
}

/** Porcentaje (0–100) usado de la cuota gratis mensual de voz. */
export const porcentajeCuota = (usado = 0, cuota = 0) => (cuota > 0 ? Math.min(100, Math.round((usado / cuota) * 100)) : 0);

/** Primer día del mes y hoy, en YYYY-MM-DD, como rango por defecto. */
export function rangoMesActual(hoy = new Date()) {
  const fecha = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { desde: fecha(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: fecha(hoy) };
}
