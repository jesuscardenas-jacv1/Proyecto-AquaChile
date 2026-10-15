import { ETAPAS_PLANNER, MODALIDADES_ENTREVISTA } from '../datos/constantes';
import { normalizar as normalizarTexto } from './texto';

/**
 * Reglas del Planner de la psicóloga.
 *
 * Cada solicitud guarda su `etapa` (recibida, agendada, realizada, informe) y los datos
 * de la entrevista (`fechaEntrevista`, `horaEntrevista`, `modalidadEntrevista`).
 * La etapa siempre debe calzar con el estado oficial (Pendiente / En proceso / Finalizada):
 * si el estado se cambia desde otra pantalla (panel de gestión o registro de evaluación),
 * la etapa se deduce del estado para que el Planner nunca muestre algo contradictorio.
 */

const HORA_VALIDA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;
const HORA_MINIMA = '08:00';
const HORA_MAXIMA = '20:00';

const ETAPA_POR_ID = Object.fromEntries(ETAPAS_PLANNER.map((etapa) => [etapa.id, etapa]));
const IDS_ETAPAS = ETAPAS_PLANNER.map((etapa) => etapa.id);

/** Etapa que corresponde por defecto a cada estado oficial. */
const ETAPA_POR_ESTADO = {
  Pendiente: 'recibida',
  'En proceso': 'agendada',
  Finalizada: 'informe',
};

/** Devuelve la definición de una etapa (título, estado, ícono) o null. */
export function obtenerEtapa(id) {
  return ETAPA_POR_ID[id] ?? null;
}

/** Estado oficial que corresponde a una etapa del Planner. */
export function estadoDeEtapa(idEtapa) {
  return ETAPA_POR_ID[idEtapa]?.estado ?? 'Pendiente';
}

/**
 * Etapa actual de una solicitud. Usa la etapa guardada si es coherente con el estado;
 * si no existe o quedó desfasada, la deduce del estado.
 */
export function etapaDeSolicitud(solicitud) {
  if (!solicitud) return 'recibida';
  const guardada = ETAPA_POR_ID[solicitud.etapa];
  if (guardada && guardada.estado === solicitud.estado) return guardada.id;
  return ETAPA_POR_ESTADO[solicitud.estado] ?? 'recibida';
}

/** Etapa siguiente y anterior dentro del flujo (null en los extremos). */
export function etapaSiguiente(idEtapa) {
  const indice = IDS_ETAPAS.indexOf(idEtapa);
  return indice >= 0 && indice < IDS_ETAPAS.length - 1 ? IDS_ETAPAS[indice + 1] : null;
}

export function etapaAnterior(idEtapa) {
  const indice = IDS_ETAPAS.indexOf(idEtapa);
  return indice > 0 ? IDS_ETAPAS[indice - 1] : null;
}

const claveEntrevista = (solicitud) =>
  `${solicitud.fechaEntrevista ?? '9999-12-31'} ${solicitud.horaEntrevista ?? '99:99'}`;

const fechaInforme = (solicitud, evaluacionesPorSolicitud) => {
  const evaluacion = evaluacionesPorSolicitud[solicitud.id];
  return evaluacion?.fechaInforme || evaluacion?.fechaEvaluacion || solicitud.fechaSolicitud || '';
};

/**
 * Agrupa las solicitudes en las 4 columnas del Planner y las ordena según lo que
 * la psicóloga necesita ver primero en cada una:
 * - Recibidas: la más antigua primero (lleva más tiempo esperando).
 * - Agendadas y realizadas: por fecha y hora de la entrevista.
 * - Informe enviado: el más reciente primero.
 */
export function agruparPorEtapa(solicitudes = [], evaluaciones = []) {
  const evaluacionesPorSolicitud = Object.fromEntries(
    evaluaciones.map((evaluacion) => [evaluacion.solicitudId, evaluacion]),
  );
  const grupos = Object.fromEntries(IDS_ETAPAS.map((id) => [id, []]));

  solicitudes.forEach((solicitud) => {
    grupos[etapaDeSolicitud(solicitud)].push(solicitud);
  });

  grupos.recibida.sort(
    (a, b) => (a.fechaSolicitud ?? '').localeCompare(b.fechaSolicitud ?? '') || a.id - b.id,
  );
  grupos.agendada.sort((a, b) => claveEntrevista(a).localeCompare(claveEntrevista(b)));
  grupos.realizada.sort((a, b) => claveEntrevista(a).localeCompare(claveEntrevista(b)));
  grupos.informe.sort(
    (a, b) =>
      fechaInforme(b, evaluacionesPorSolicitud).localeCompare(
        fechaInforme(a, evaluacionesPorSolicitud),
      ) || b.id - a.id,
  );

  return grupos;
}

/** Formatea una fecha ISO como "9/09", igual que las tarjetas del Planner original. */
export function fechaCorta(fecha) {
  if (!fecha || !FECHA_VALIDA.test(fecha)) return '';
  const [, mes, dia] = fecha.split('-');
  return `${Number(dia)}/${mes}`;
}

/** Texto de la tarjeta: "Entrevista coordinada para 9/09 a las 12:30". */
export function textoEntrevista(solicitud) {
  if (!solicitud?.fechaEntrevista) return 'Entrevista por coordinar';
  const hora = solicitud.horaEntrevista ? ` a las ${solicitud.horaEntrevista}` : '';
  return `Entrevista coordinada para ${fechaCorta(solicitud.fechaEntrevista)}${hora}`;
}

/** Días corridos entre dos fechas ISO (yyyy-mm-dd). */
export function diasEntre(desde, hasta) {
  if (!desde || !hasta) return null;
  const inicio = Date.parse(`${desde}T00:00:00Z`);
  const fin = Date.parse(`${hasta}T00:00:00Z`);
  if (Number.isNaN(inicio) || Number.isNaN(fin)) return null;
  return Math.round((fin - inicio) / 86400000);
}

/** Fecha de hoy en formato ISO según la hora local del navegador. */
export function hoyIso(fecha = new Date()) {
  const desfase = fecha.getTimezoneOffset() * 60000;
  return new Date(fecha.getTime() - desfase).toISOString().slice(0, 10);
}

/**
 * Valida los datos para agendar (o reagendar) una entrevista.
 * @returns {Object} errores por campo (vacío si es válido).
 */
export function validarAgenda(agenda = {}, solicitud = {}) {
  const errores = {};
  const fecha = agenda.fechaEntrevista?.trim?.() ?? '';
  const hora = agenda.horaEntrevista?.trim?.() ?? '';

  if (!fecha) {
    errores.fechaEntrevista = 'Debe indicar la fecha de la entrevista.';
  } else if (!FECHA_VALIDA.test(fecha) || Number.isNaN(Date.parse(fecha))) {
    errores.fechaEntrevista = 'La fecha no es válida.';
  } else if (solicitud.fechaSolicitud && fecha < solicitud.fechaSolicitud) {
    errores.fechaEntrevista = 'La entrevista no puede ser anterior a la fecha de la solicitud.';
  }

  if (!hora) {
    errores.horaEntrevista = 'Debe indicar la hora de la entrevista.';
  } else if (!HORA_VALIDA.test(hora)) {
    errores.horaEntrevista = 'La hora debe tener el formato HH:MM.';
  } else if (hora < HORA_MINIMA || hora > HORA_MAXIMA) {
    errores.horaEntrevista = `La hora debe estar entre las ${HORA_MINIMA} y las ${HORA_MAXIMA}.`;
  }

  if (!MODALIDADES_ENTREVISTA.includes(agenda.modalidadEntrevista)) {
    errores.modalidadEntrevista = 'Debe seleccionar la modalidad de la entrevista.';
  }

  return errores;
}

/**
 * Indica qué movimiento se puede hacer desde el Planner.
 * - recibida → agendada: requiere datos de agenda (se piden en una ventana).
 * - agendada → realizada: directo.
 * - realizada → informe: no se mueve a mano; se registra la evaluación con su
 *   resultado y eso finaliza la solicitud (misma regla que el resto de la app).
 * - Retroceder solo entre las etapas en proceso; un informe enviado no se reabre aquí.
 */
export function accionesDisponibles(idEtapa) {
  return {
    avanzar: idEtapa === 'recibida' || idEtapa === 'agendada',
    requiereAgenda: idEtapa === 'recibida',
    registrarInforme: idEtapa === 'realizada',
    reagendar: idEtapa === 'agendada',
    retroceder: idEtapa === 'agendada' || idEtapa === 'realizada',
  };
}

/* ------------------------------------------------------------------------- */
/* Pantalla "Informes enviados": filtros, resumen y paginación.              */
/* ------------------------------------------------------------------------- */

/** Fecha en que se envió el informe de una solicitud finalizada. */
export function fechaInformeDe(solicitud, evaluacion) {
  return evaluacion?.fechaInforme || evaluacion?.fechaEvaluacion || solicitud?.fechaSolicitud || '';
}

/**
 * Filtra y ordena los informes enviados.
 * @param {Array} informes elementos { solicitud, candidato, evaluacion }
 * @param {Object} criterios { texto, resultado, solicitante, orden: 'recientes' | 'antiguos' | 'nombre' }
 */
export function filtrarInformes(informes = [], criterios = {}) {
  const { texto = '', resultado = '', solicitante = '', orden = 'recientes' } = criterios;
  const busqueda = normalizarTexto(texto.trim());

  const filtrados = informes.filter(({ solicitud, candidato, evaluacion }) => {
    if (resultado && evaluacion?.resultado !== resultado) return false;
    if (solicitante && solicitud.profesionalResponsable !== solicitante) return false;
    if (!busqueda) return true;
    return normalizarTexto(
      [candidato?.nombre, solicitud.cargo, solicitud.familiaCargo, solicitud.ubicacion, `#${solicitud.id}`].join(' '),
    ).includes(busqueda);
  });

  const porFecha = (a, b) =>
    fechaInformeDe(a.solicitud, a.evaluacion).localeCompare(fechaInformeDe(b.solicitud, b.evaluacion)) ||
    a.solicitud.id - b.solicitud.id;

  if (orden === 'antiguos') return filtrados.sort(porFecha);
  if (orden === 'nombre') {
    return filtrados.sort((a, b) =>
      (a.candidato?.nombre ?? '').localeCompare(b.candidato?.nombre ?? '', 'es'),
    );
  }
  return filtrados.sort((a, b) => porFecha(b, a));
}

/** Cuenta los informes por resultado (para las tarjetas de resumen). */
export function resumenResultados(informes = [], resultados = []) {
  const conteo = Object.fromEntries(resultados.map((resultado) => [resultado, 0]));
  informes.forEach(({ evaluacion }) => {
    if (evaluacion?.resultado in conteo) conteo[evaluacion.resultado] += 1;
  });
  return conteo;
}

/**
 * Devuelve una página de la lista. Si la página pedida no existe, entrega la más cercana.
 * @returns {{ elementos: Array, pagina: number, totalPaginas: number, desde: number, hasta: number }}
 */
export function paginar(lista = [], pagina = 1, tamano = 12) {
  const totalPaginas = Math.max(1, Math.ceil(lista.length / tamano));
  const actual = Math.min(Math.max(1, Number(pagina) || 1), totalPaginas);
  const inicio = (actual - 1) * tamano;
  const elementos = lista.slice(inicio, inicio + tamano);
  return {
    elementos,
    pagina: actual,
    totalPaginas,
    desde: elementos.length ? inicio + 1 : 0,
    hasta: inicio + elementos.length,
  };
}

/** Números de página a mostrar, con "…" cuando hay muchas (ej: 1 … 4 5 6 … 9). */
export function paginasVisibles(pagina, totalPaginas) {
  if (totalPaginas <= 7) return Array.from({ length: totalPaginas }, (_, i) => i + 1);
  const cercanas = [pagina - 1, pagina, pagina + 1].filter((n) => n > 1 && n < totalPaginas);
  const paginas = [1, ...cercanas, totalPaginas];
  return paginas.flatMap((numero, indice) =>
    indice > 0 && numero - paginas[indice - 1] > 1 ? ['…', numero] : [numero],
  );
}
