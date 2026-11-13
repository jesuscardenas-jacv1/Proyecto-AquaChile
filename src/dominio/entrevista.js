/**
 * Lógica del panel de entrevista (sin React): resumen del CV para la entrevista, nombres de los
 * hablantes, marcas de tiempo, citas y etiquetas de competencia en las notas.
 */
import { COMPETENCIAS } from '../datos/constantes';

/** "04:05" o "1:02:05" a partir de milisegundos. */
export function marcaTiempo(milisegundos = 0) {
  const total = Math.max(0, Math.floor(milisegundos / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dos = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}`;
}

/**
 * Criterios del análisis del CV agrupados para la entrevista:
 * fortalezas (cumple), brechas (parcial o sin evidencia) y por confirmar (no evaluable con un CV).
 */
export function agruparCriterios(criterios = []) {
  return {
    fortalezas: criterios.filter((criterio) => criterio.nivel === 'cumple'),
    brechas: criterios.filter((criterio) => criterio.nivel === 'parcial' || criterio.nivel === 'sin-evidencia'),
    porConfirmar: criterios.filter((criterio) => criterio.nivel === 'no-evaluable'),
  };
}

/** Orden de aparición de los hablantes: "Guest-2" → 2. Sin id → null. */
const numeroHablante = (id) => {
  const coincidencia = /(\d+)\s*$/.exec(id ?? '');
  return coincidencia ? Number(coincidencia[1]) : null;
};

/** "Psicóloga" / "Postulante" si se asignó; si no, "Hablante 1". */
export function nombreHablante(id, hablantes = {}) {
  if (hablantes[id]) return hablantes[id];
  const numero = numeroHablante(id);
  return numero ? `Hablante ${numero}` : 'Hablante';
}

/** Hablantes distintos que aparecen en la transcripción, en orden. */
export const hablantesDetectados = (segmentos = []) =>
  [...new Set(segmentos.map((segmento) => segmento.hablante).filter(Boolean))].sort(
    (a, b) => (numeroHablante(a) ?? 0) - (numeroHablante(b) ?? 0),
  );

/**
 * Transcripción como texto para la pauta y la IA: un turno por párrafo, uniendo las frases
 * seguidas de un mismo hablante. "[00:01:05] Postulante: …".
 */
export function textoTranscripcion(segmentos = [], hablantes = {}) {
  const turnos = [];
  segmentos.forEach((segmento) => {
    const ultimo = turnos.at(-1);
    if (ultimo && ultimo.hablante === segmento.hablante) ultimo.texto += ` ${segmento.texto}`;
    else turnos.push({ ...segmento });
  });
  const reloj = (ms) => {
    const total = Math.floor(ms / 1000);
    return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
      .map((parte) => String(parte).padStart(2, '0'))
      .join(':');
  };
  return turnos
    .map((turno) => `[${reloj(turno.inicioMs)}] ${nombreHablante(turno.hablante, hablantes)}: ${turno.texto}`)
    .join('\n\n');
}

/** Línea de cita para las notas: «[03:12 · Postulante] "…"». */
export const citaParaNotas = (segmento, hablantes = {}) =>
  `[${marcaTiempo(segmento.inicioMs)} · ${nombreHablante(segmento.hablante, hablantes)}] "${segmento.texto}"`;

/** Agrega una línea al final de las notas, en su propio renglón. */
export function agregarLinea(notas, linea) {
  if (!notas.trim()) return linea;
  return `${notas.replace(/\s+$/, '')}\n${linea}`;
}

/** Etiqueta de competencia para empezar una nota: "[03:12 · Liderazgo] ". */
export const etiquetaCompetencia = (competencia, milisegundos) => `[${marcaTiempo(milisegundos)} · ${competencia}] `;

/** Competencias del catálogo que ya tienen al menos una nota etiquetada. */
export function competenciasConNotas(notas = '', catalogo = COMPETENCIAS) {
  return catalogo.filter((competencia) => notas.includes(`· ${competencia}]`));
}

/** "Guardado hace 5 s" / "hace 2 min" desde una fecha ISO o "AAAA-MM-DD HH:MM:SS" (UTC). */
export function tiempoDesde(fecha, ahora = Date.now()) {
  if (!fecha) return '';
  const momento = new Date(/Z|[+-]\d\d:?\d\d$/.test(fecha) ? fecha : `${fecha.replace(' ', 'T')}Z`).getTime();
  if (Number.isNaN(momento)) return '';
  const segundos = Math.max(0, Math.round((ahora - momento) / 1000));
  if (segundos < 60) return `hace ${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  return `hace ${Math.floor(minutos / 60)} h`;
}

/** ¿La entrevista tiene algo que guardar o cerrar? */
export const tieneContenido = ({ notas = '', transcripcion = [] } = {}) =>
  Boolean(notas.trim() || transcripcion.length);
