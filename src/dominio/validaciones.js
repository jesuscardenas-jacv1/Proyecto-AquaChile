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

const CECO_VALIDO = /^[A-Z]\d{9}$/i;

/**
 * Valida el formulario de solicitud de evaluación (réplica del Microsoft Forms).
 * Si el candidato no está registrado (`candidatoId` vacío), exige sus datos de contacto
 * para registrarlo junto con la solicitud.
 */
export function validarFormularioSolicitud(formulario = {}, candidatos = []) {
  const { candidatoId, ...resto } = validarSolicitud(formulario, candidatos);
  const errores = { ...resto };
  const nombreCandidato = limpiar(formulario.nombreCandidato);
  const ceco = limpiar(formulario.ceco);

  if (!limpiar(formulario.profesionalResponsable)) {
    errores.profesionalResponsable = 'Debe seleccionar el reclutador/a.';
  }

  if (formulario.candidatoId) {
    if (candidatoId) errores.nombreCandidato = candidatoId;
  } else {
    const { nombre, correo, telefono } = validarCandidato({
      nombre: nombreCandidato,
      correo: formulario.correo,
      telefono: formulario.telefono,
    });
    if (nombre) errores.nombreCandidato = nombre;
    if (correo) errores.correo = correo;
    if (telefono) errores.telefono = telefono;
  }

  if (!limpiar(formulario.origen)) {
    errores.origen = 'Debe indicar el origen del candidato/a.';
  }

  if (!limpiar(formulario.ubicacion)) {
    errores.ubicacion = 'La ubicación del cargo es obligatoria.';
  }

  if (!limpiar(formulario.requiereReferencias)) {
    errores.requiereReferencias = 'Debe indicar si requiere referencias.';
  }

  if (!ceco) {
    errores.ceco = 'El CECO es obligatorio.';
  } else if (!CECO_VALIDO.test(ceco)) {
    errores.ceco = 'El CECO debe tener una letra seguida de 9 dígitos (ej: A170010311).';
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
