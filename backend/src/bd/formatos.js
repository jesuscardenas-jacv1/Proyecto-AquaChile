/**
 * Convierte las filas de SQLite (snake_case) al formato que usa el frontend (camelCase).
 * Un solo lugar para que todas las rutas respondan con la misma forma.
 */
const { puedeVerNotasClinicas } = require('../middlewares/auth');
const { leerCompetencias } = require('./competencias');

function formatearCandidato(c) {
  return {
    id: c.id,
    nombre: c.nombre,
    correo: c.correo,
    telefono: c.telefono,
    cargo: c.cargo,
    familiaCargo: c.familia_cargo,
    origen: c.origen,
  };
}

function formatearSolicitud(s) {
  return {
    id: s.id,
    candidatoId: s.candidato_id,
    cargo: s.cargo,
    familiaCargo: s.familia_cargo,
    fechaSolicitud: s.fecha_solicitud,
    estado: s.estado,
    etapa: s.etapa ?? '',
    reclutador: s.reclutador ?? '',
    profesionalResponsable: s.profesional_responsable,
    observaciones: s.observaciones,
    tipoEvaluacion: s.tipo_evaluacion,
    ubicacion: s.ubicacion,
    unidad: s.unidad,
    ceco: s.ceco,
    requiereReferencias: Boolean(s.requiere_referencias),
    referido: s.referido === null ? null : Boolean(s.referido),
    cv: s.cv,
    descriptorCargo: s.descriptor_cargo,
    fechaEntrevista: s.fecha_entrevista ?? '',
    horaEntrevista: s.hora_entrevista ?? '',
    modalidadEntrevista: s.modalidad_entrevista ?? '',
  };
}

/** Analista y jefatura reciben la evaluación sin las observaciones clínicas. */
function formatearEvaluacion(e, rolUsuario) {
  const confidencial = !puedeVerNotasClinicas(rolUsuario);
  return {
    id: e.id,
    solicitudId: e.solicitud_id,
    fechaEvaluacion: e.fecha_evaluacion,
    resultado: e.resultado,
    estado: e.estado,
    fechaInforme: e.fecha_informe,
    diasRespuesta: e.dias_respuesta,
    observaciones: confidencial ? undefined : e.observaciones,
    // Las competencias son parte del informe oficial: las ve también el analista.
    competencias: leerCompetencias(e.competencias),
    confidencial,
  };
}

function formatearOferta(o) {
  let requisitos = [];
  try {
    requisitos = JSON.parse(o.requisitos);
  } catch {
    // Requisitos ilegibles: la oferta se muestra sin ellos.
  }
  return {
    id: o.id,
    titulo: o.titulo,
    area: o.area,
    cargo: o.cargo,
    familiaCargo: o.familia_cargo,
    ubicacion: o.ubicacion,
    region: o.region,
    fechaPublicacion: o.fecha_publicacion,
    descripcion: o.descripcion,
    requisitos,
    jornada: o.jornada,
    estado: o.estado,
  };
}

function formatearPostulacion(p) {
  return {
    id: p.id,
    ofertaId: p.oferta_id,
    candidatoId: p.candidato_id,
    fechaPostulacion: p.fecha_postulacion,
    estado: p.estado,
    ciudad: p.ciudad,
    cvNombre: p.cv_nombre,
    solicitudId: p.solicitud_id ?? null,
  };
}

module.exports = {
  formatearCandidato,
  formatearSolicitud,
  formatearEvaluacion,
  formatearOferta,
  formatearPostulacion,
};
