/**
 * Movimiento de una solicitud en el Planner de la psicóloga (etapa, estado oficial y agenda de la
 * entrevista). Lo usan PATCH /api/solicitudes/:id/etapa y Marea al confirmar una hora, para que
 * agendar siga un solo flujo.
 *
 * Reunión online: con la modalidad "Google Meet" se crea o actualiza el evento en Google
 * Calendar con su enlace de Meet; con "Teams" se acepta `enlaceReunion` pegado a mano (o se
 * crea con Microsoft Graph si REUNIONES_TEAMS=graph). Si el calendario falla, la agenda se
 * guarda igual y se devuelve `avisoReunion`.
 */
const db = require('./conexion');
const { formatearSolicitud } = require('./formatos');
const { claveCarpeta } = require('../almacenamiento/comun');
const { sincronizarReunion, validarEnlaceReunion } = require('../reuniones');

/** Etapas del Planner y el estado oficial que corresponde a cada una (igual que el frontend). */
const ESTADO_DE_ETAPA = {
  recibida: 'Pendiente',
  agendada: 'En proceso',
  realizada: 'En proceso',
  informe: 'Finalizada',
};
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

class ErrorPlanner extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

const obtener = (id) => db.prepare('SELECT * FROM solicitudes WHERE id = ?').get(id);
const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

/**
 * Cambia la etapa de la solicitud y su agenda. Lanza ErrorPlanner con el status HTTP si no se puede.
 * Volver a "recibida" deja la entrevista nuevamente por coordinar (y cancela su evento).
 * @returns {Promise<{ solicitud: object, avisoReunion: string | null }>}
 */
async function cambiarEtapa(id, { etapa, fechaEntrevista, horaEntrevista, modalidadEntrevista, enlaceReunion } = {}) {
  const actual = obtener(id);
  if (!actual) throw new ErrorPlanner(`Solicitud #${id} no encontrada.`, 404);
  if (actual.motivo_cierre) {
    throw new ErrorPlanner('La solicitud se cerró sin evaluación: reábrala para moverla en el Planner.', 409);
  }
  if (!ESTADO_DE_ETAPA[etapa]) {
    throw new ErrorPlanner(`Etapa inválida. Debe ser una de: ${Object.keys(ESTADO_DE_ETAPA).join(', ')}.`);
  }
  if (fechaEntrevista && !FECHA_ISO.test(fechaEntrevista)) {
    throw new ErrorPlanner('La fecha de la entrevista debe tener el formato yyyy-mm-dd.');
  }
  if (horaEntrevista && !HORA.test(horaEntrevista)) {
    throw new ErrorPlanner('La hora de la entrevista debe tener el formato HH:MM.');
  }
  // Enlace pegado a mano (Teams): '' lo borra; si viene, debe ser https:// de Meet o de Teams.
  let enlacePegado;
  if (enlaceReunion !== undefined && enlaceReunion !== null) {
    enlacePegado = texto(enlaceReunion);
    if (enlacePegado && !(enlacePegado = validarEnlaceReunion(enlacePegado))) {
      throw new ErrorPlanner('El enlace de la reunión debe ser una dirección https:// de Google Meet o de Microsoft Teams.');
    }
  }

  const agenda =
    etapa === 'recibida'
      ? { fecha: '', hora: '', modalidad: '' }
      : {
          fecha: texto(fechaEntrevista) || actual.fecha_entrevista,
          hora: texto(horaEntrevista) || actual.hora_entrevista,
          modalidad: texto(modalidadEntrevista) || actual.modalidad_entrevista,
        };
  const agendando =
    etapa !== 'recibida' &&
    Boolean(fechaEntrevista || horaEntrevista || modalidadEntrevista || enlacePegado !== undefined) &&
    Boolean(agenda.fecha && agenda.hora);

  const nombre = db.prepare('SELECT nombre FROM candidatos WHERE id = ?').get(actual.candidato_id)?.nombre;
  const reunion = await sincronizarReunion({
    actual,
    etapa,
    agenda,
    agendando,
    enlacePegado,
    titulo: `Entrevista psicolaboral: ${nombre ?? 'candidato'} · ${actual.cargo}`,
    descripcion: `Solicitud ${claveCarpeta(id)} · ${actual.cargo}. Creada desde el Planner de Gestión Psicolaboral (prototipo académico).`,
  });

  // La fecha de cambio de etapa solo se renueva cuando la etapa realmente cambia.
  db.prepare(
    `UPDATE solicitudes
     SET etapa = ?, estado = ?, fecha_entrevista = ?, hora_entrevista = ?, modalidad_entrevista = ?,
         enlace_reunion = ?, evento_reunion_id = ?, proveedor_reunion = ?,
         etapa_cambiada_en = CASE WHEN etapa = ? THEN etapa_cambiada_en ELSE datetime('now') END,
         actualizado_en = datetime('now')
     WHERE id = ?`,
  ).run(
    etapa, ESTADO_DE_ETAPA[etapa], agenda.fecha, agenda.hora, agenda.modalidad,
    reunion.enlace, reunion.eventoId, reunion.proveedor, etapa, id,
  );

  return { solicitud: formatearSolicitud(obtener(id)), avisoReunion: reunion.aviso };
}

module.exports = { ESTADO_DE_ETAPA, ErrorPlanner, cambiarEtapa };
