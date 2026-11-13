/**
 * Presentación del cumplimiento de requisitos del análisis de CV con IA.
 * El porcentaje lo calcula el backend (backend/src/ia/cumplimiento.js); aquí solo se muestra.
 */

export const NIVELES_REQUISITO = {
  cumple: { etiqueta: 'Cumple', icono: 'bi-check-circle-fill', clase: 'text-success' },
  parcial: { etiqueta: 'Parcial', icono: 'bi-dash-circle-fill', clase: 'text-warning' },
  'sin-evidencia': { etiqueta: 'Sin evidencia en el CV', icono: 'bi-x-circle', clase: 'text-secondary' },
  'no-evaluable': { etiqueta: 'Confirmar en la entrevista', icono: 'bi-question-circle', clase: 'text-info' },
};

export const nivelRequisito = (nivel) => NIVELES_REQUISITO[nivel] ?? NIVELES_REQUISITO['sin-evidencia'];

/**
 * Tramo del porcentaje, con un texto descriptivo (no un dictamen) y el color de la barra.
 * Sin porcentaje (no había requisitos evaluables) devuelve null.
 */
export function tramoCumplimiento(porcentaje) {
  if (porcentaje === null || porcentaje === undefined) return null;
  if (porcentaje >= 75) return { texto: 'El CV respalda la mayoría de los requisitos', color: 'bg-success' };
  if (porcentaje >= 50) return { texto: 'El CV respalda parte de los requisitos', color: 'bg-warning' };
  return { texto: 'El CV respalda pocos requisitos', color: 'bg-secondary' };
}

/** "requisitos de la oferta" o "requisitos del descriptor del cargo". */
export const textoFuente = (fuente) =>
  fuente === 'descriptor' ? 'los requisitos del descriptor del cargo' : 'los requisitos de la oferta';

/**
 * Separa los requisitos del análisis en tres grupos para leerlos de un vistazo:
 * - cumple: lo que el CV respalda.
 * - brechas: parcial o sin evidencia (lo que le falta para el cargo), obligatorios primero.
 * - porConfirmar: lo que solo se puede comprobar en la entrevista.
 */
export function agruparRequisitos(criterios = []) {
  const obligatoriosPrimero = (a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'obligatorio' ? -1 : 1);
  return {
    cumple: criterios.filter((criterio) => criterio.nivel === 'cumple'),
    brechas: criterios
      .filter((criterio) => criterio.nivel === 'parcial' || criterio.nivel === 'sin-evidencia' || !NIVELES_REQUISITO[criterio.nivel])
      .sort(obligatoriosPrimero),
    porConfirmar: criterios.filter((criterio) => criterio.nivel === 'no-evaluable'),
  };
}
