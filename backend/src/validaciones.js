/**
 * Validaciones de la API. Replican las reglas del frontend (src/dominio/validaciones.js)
 * para que la API no dependa de que el cliente haya validado antes de enviar.
 */

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const TELEFONO_VALIDO = /^\+?[0-9]{8,15}$/;
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

const ESTADOS_SOLICITUD = ['Pendiente', 'En proceso', 'Finalizada'];
const RESULTADOS_EVALUACION = ['Recomendado', 'Recomendado con observaciones', 'No recomendado'];
/** Estados de solicitud que permiten registrar una evaluación (igual que el frontend). */
const ESTADOS_QUE_PERMITEN_EVALUAR = ['En proceso', 'Finalizada'];

/** Error con código HTTP; el manejador global lo convierte en respuesta JSON. */
class ErrorHttp extends Error {
  constructor(status, mensaje, errores) {
    super(mensaje);
    this.status = status;
    if (errores) this.errores = errores;
  }
}

const limpiar = (valor) => (typeof valor === 'string' ? valor.trim() : '');
const hoy = () => new Date().toISOString().slice(0, 10);

function esFechaValida(texto) {
  if (!FECHA_ISO.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
}

/** Valida una fecha opcional (AAAA-MM-DD, existente y no futura). Devuelve el mensaje o null. */
function errorDeFecha(valor, etiqueta) {
  if (valor === undefined || valor === null || valor === '') return null;
  const texto = limpiar(valor);
  if (!esFechaValida(texto)) return `La ${etiqueta} debe tener formato AAAA-MM-DD.`;
  if (texto > hoy()) return `La ${etiqueta} no puede ser futura.`;
  return null;
}

/** Lanza 400 con el detalle por campo si hay errores. */
function exigirSinErrores(errores) {
  if (Object.keys(errores).length > 0) {
    throw new ErrorHttp(400, 'Los datos enviados no son válidos.', errores);
  }
}

/** Convierte un parámetro de ruta en id entero positivo o lanza 400. */
function idValido(valor, etiqueta = 'id') {
  const texto = String(valor ?? '');
  const id = Number(texto);
  if (!/^\d+$/.test(texto) || !Number.isSafeInteger(id) || id <= 0) {
    throw new ErrorHttp(400, `El ${etiqueta} debe ser un número entero positivo.`);
  }
  return id;
}

function validarCandidato(candidato = {}) {
  const errores = {};
  const nombre = limpiar(candidato.nombre);
  const correo = limpiar(candidato.correo);
  const telefono = limpiar(candidato.telefono);

  if (!nombre) errores.nombre = 'El nombre del candidato es obligatorio.';
  else if (nombre.length < 3) errores.nombre = 'El nombre debe tener al menos 3 caracteres.';

  if (!correo) errores.correo = 'El correo es obligatorio.';
  else if (!CORREO_VALIDO.test(correo)) errores.correo = 'El correo no tiene un formato válido.';

  if (!telefono) errores.telefono = 'El teléfono es obligatorio.';
  else if (!TELEFONO_VALIDO.test(telefono.replace(/[\s-]/g, ''))) {
    errores.telefono = 'El teléfono debe contener solo números (8 a 15 dígitos).';
  }

  if (!limpiar(candidato.cargo)) errores.cargo = 'El cargo es obligatorio.';
  if (!limpiar(candidato.familiaCargo)) errores.familiaCargo = 'Debe indicar la familia de cargo.';

  return errores;
}

function validarSolicitud(solicitud = {}) {
  const errores = {};
  const candidatoId = Number(solicitud.candidatoId);
  if (!Number.isSafeInteger(candidatoId) || candidatoId <= 0) {
    errores.candidatoId = 'Debe especificar un candidato válido.';
  }
  if (!limpiar(solicitud.cargo)) errores.cargo = 'El cargo es obligatorio.';
  if (!limpiar(solicitud.familiaCargo)) errores.familiaCargo = 'Debe indicar la familia de cargo.';
  const fecha = errorDeFecha(solicitud.fechaSolicitud, 'fecha de solicitud');
  if (fecha) errores.fechaSolicitud = fecha;
  return errores;
}

/** Valida una evaluación. Con `parcial` solo revisa los campos presentes (para PUT). */
function validarEvaluacion(evaluacion = {}, { parcial = false } = {}) {
  const errores = {};
  const { resultado, observaciones } = evaluacion;

  if (!parcial || resultado !== undefined) {
    if (!RESULTADOS_EVALUACION.includes(resultado)) {
      errores.resultado = `Resultado inválido. Opciones: ${RESULTADOS_EVALUACION.join(', ')}.`;
    }
  }

  if (!parcial || observaciones !== undefined) {
    const texto = limpiar(observaciones);
    if (!texto) errores.observaciones = 'Las observaciones son obligatorias.';
    else if (texto.length < 10) {
      errores.observaciones = 'Las observaciones deben tener al menos 10 caracteres.';
    }
  }

  const fecha = errorDeFecha(evaluacion.fechaEvaluacion, 'fecha de evaluación');
  if (fecha) errores.fechaEvaluacion = fecha;

  return errores;
}

module.exports = {
  ErrorHttp,
  ESTADOS_SOLICITUD,
  RESULTADOS_EVALUACION,
  ESTADOS_QUE_PERMITEN_EVALUAR,
  limpiar,
  idValido,
  exigirSinErrores,
  validarCandidato,
  validarSolicitud,
  validarEvaluacion,
};
