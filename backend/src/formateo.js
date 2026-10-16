/**
 * Conversión de filas SQLite (snake_case) al formato que usa el frontend (camelCase).
 * Centralizado aquí para que todas las rutas respondan con la misma forma.
 */

function formatearCandidato(c) {
  return {
    id: c.id,
    nombre: c.nombre,
    correo: c.correo,
    telefono: c.telefono,
    cargo: c.cargo,
    familiaCargo: c.familia_cargo,
    origen: c.origen,
    creadoEn: c.creado_en,
  };
}

function formatearSolicitud(s) {
  return {
    id: s.id,
    candidatoId: s.candidato_id,
    candidatoNombre: s.candidato_nombre,
    cargo: s.cargo,
    familiaCargo: s.familia_cargo,
    fechaSolicitud: s.fecha_solicitud,
    estado: s.estado,
    profesionalResponsable: s.profesional_responsable,
    observaciones: s.observaciones,
    tipoEvaluacion: s.tipo_evaluacion,
    ubicacion: s.ubicacion,
    unidad: s.unidad,
    ceco: s.ceco,
    requiereReferencias: Boolean(s.requiere_referencias),
    // null = sin dato (la columna admite NULL); no se convierte a false.
    referido: s.referido === null || s.referido === undefined ? null : Boolean(s.referido),
    cv: s.cv,
    descriptorCargo: s.descriptor_cargo,
    // null = sin etapa guardada: el frontend la deduce del estado
    etapa: s.etapa ?? null,
    fechaEntrevista: s.fecha_entrevista ?? '',
    horaEntrevista: s.hora_entrevista ?? '',
    modalidadEntrevista: s.modalidad_entrevista ?? '',
    creadoEn: s.creado_en,
  };
}

/**
 * Regla de confidencialidad: el analista solo ve el dictamen, nunca las
 * observaciones clínicas de la psicóloga.
 */
function formatearEvaluacion(e, rolUsuario) {
  const confidencial = rolUsuario === 'analista';
  return {
    id: e.id,
    solicitudId: e.solicitud_id,
    fechaEvaluacion: e.fecha_evaluacion,
    resultado: e.resultado,
    estado: e.estado,
    fechaInforme: e.fecha_informe,
    diasRespuesta: e.dias_respuesta,
    observaciones: confidencial ? undefined : e.observaciones,
    confidencial,
    creadoEn: e.creado_en,
  };
}

module.exports = { formatearCandidato, formatearSolicitud, formatearEvaluacion };
