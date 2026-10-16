/**
 * Reglas del Planner de la psicóloga en la API.
 * Replican src/dominio/planner.js y src/datos/constantes.js del frontend.
 *
 * Cada etapa corresponde a un estado oficial de la solicitud:
 *   recibida → Pendiente · agendada / realizada → En proceso · informe → Finalizada
 */

const ESTADO_DE_ETAPA = {
  recibida: 'Pendiente',
  agendada: 'En proceso',
  realizada: 'En proceso',
  informe: 'Finalizada',
};

/** Etapa por defecto de cada estado (cuando el estado cambia desde otra pantalla). */
const ETAPA_POR_ESTADO = {
  Pendiente: 'recibida',
  'En proceso': 'agendada',
  Finalizada: 'informe',
};

/** Etapas a las que se puede mover una solicitud desde el Planner. */
const ETAPAS_MANUALES = ['recibida', 'agendada', 'realizada'];

const MODALIDADES_ENTREVISTA = ['Teams', 'Presencial', 'Telefónica'];

const HORA_VALIDA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;
const HORA_MINIMA = '08:00';
const HORA_MAXIMA = '20:00';

/** Valida fecha, hora y modalidad de la entrevista. Devuelve errores por campo. */
function validarAgenda(agenda = {}, fechaSolicitud = '') {
  const errores = {};
  const fecha = typeof agenda.fechaEntrevista === 'string' ? agenda.fechaEntrevista.trim() : '';
  const hora = typeof agenda.horaEntrevista === 'string' ? agenda.horaEntrevista.trim() : '';

  if (!fecha) {
    errores.fechaEntrevista = 'Debe indicar la fecha de la entrevista.';
  } else if (!FECHA_VALIDA.test(fecha) || Number.isNaN(Date.parse(fecha))) {
    errores.fechaEntrevista = 'La fecha no es válida.';
  } else if (fechaSolicitud && fecha < fechaSolicitud) {
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

/** True si el body trae algún dato de agenda. */
function traeAgenda(datos = {}) {
  return ['fechaEntrevista', 'horaEntrevista', 'modalidadEntrevista'].some(
    (campo) => datos[campo] !== undefined && datos[campo] !== '',
  );
}

module.exports = {
  ESTADO_DE_ETAPA,
  ETAPA_POR_ESTADO,
  ETAPAS_MANUALES,
  validarAgenda,
  traeAgenda,
};
