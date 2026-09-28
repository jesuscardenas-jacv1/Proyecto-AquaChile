const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const TELEFONO_VALIDO = /^\+?[0-9]{8,15}$/;
const HOY = () => new Date().toISOString().slice(0, 10);

const limpiar = (valor) => (typeof valor === 'string' ? valor.trim() : valor ?? '');

/**
 * Valida los datos de un candidato.
 * @returns {Object} objeto con los mensajes de error por campo (vacio si es valido).
 */
export function validarCandidato(candidato = {}) {
  const errores = {};
  const nombre = limpiar(candidato.nombre);
  const correo = limpiar(candidato.correo);
  const telefono = limpiar(candidato.telefono);
  const cargo = limpiar(candidato.cargo);
  const familiaCargo = limpiar(candidato.familiaCargo);

  if (!nombre) {
    errores.nombre = 'El nombre del candidato es obligatorio.';
  } else if (nombre.length < 3) {
    errores.nombre = 'El nombre debe tener al menos 3 caracteres.';
  }

  if (!correo) {
    errores.correo = 'El correo es obligatorio.';
  } else if (!CORREO_VALIDO.test(correo)) {
    errores.correo = 'El correo no tiene un formato válido (ej: nombre@dominio.cl).';
  }

  if (!telefono) {
    errores.telefono = 'El teléfono es obligatorio.';
  } else if (!TELEFONO_VALIDO.test(telefono.replace(/[\s-]/g, ''))) {
    errores.telefono = 'El teléfono debe contener solo números (8 a 15 dígitos).';
  }

  if (!cargo) {
    errores.cargo = 'El cargo es obligatorio.';
  }

  if (!familiaCargo) {
    errores.familiaCargo = 'Debe seleccionar una familia de cargo.';
  }

  return errores;
}

/**
 * Valida los datos de una solicitud de evaluación.
 */
export function validarSolicitud(solicitud = {}, candidatos = []) {
  const errores = {};
  const candidatoId = solicitud.candidatoId;
  const cargo = limpiar(solicitud.cargo);
  const familiaCargo = limpiar(solicitud.familiaCargo);
  const fechaSolicitud = limpiar(solicitud.fechaSolicitud);

  if (!candidatoId) {
    errores.candidatoId = 'Debe seleccionar un candidato.';
  } else if (candidatos.length > 0 && !candidatos.some((c) => c.id === Number(candidatoId))) {
    errores.candidatoId = 'El candidato seleccionado no existe en el registro.';
  }

  if (!cargo) {
    errores.cargo = 'El cargo es obligatorio.';
  }

  if (!familiaCargo) {
    errores.familiaCargo = 'Debe seleccionar una familia de cargo.';
  }

  if (!fechaSolicitud) {
    errores.fechaSolicitud = 'La fecha de solicitud es obligatoria.';
  } else if (fechaSolicitud > HOY()) {
    errores.fechaSolicitud = 'La fecha de solicitud no puede ser futura.';
  }

  return errores;
}

/**
 * Valida los datos de una evaluación psicolaboral.
 */
export function validarEvaluacion(evaluacion = {}) {
  const errores = {};
  const fechaEvaluacion = limpiar(evaluacion.fechaEvaluacion);
  const resultado = limpiar(evaluacion.resultado);
  const observaciones = limpiar(evaluacion.observaciones);

  if (!fechaEvaluacion) {
    errores.fechaEvaluacion = 'La fecha de evaluación es obligatoria.';
  } else if (fechaEvaluacion > HOY()) {
    errores.fechaEvaluacion = 'La fecha de evaluación no puede ser futura.';
  }

  if (!resultado) {
    errores.resultado = 'Debe indicar el resultado de la evaluación.';
  }

  if (!observaciones) {
    errores.observaciones = 'Las observaciones son obligatorias.';
  } else if (observaciones.length < 10) {
    errores.observaciones = 'Las observaciones deben tener al menos 10 caracteres.';
  }

  return errores;
}

export function hayErrores(errores) {
  return Object.keys(errores).length > 0;
}
