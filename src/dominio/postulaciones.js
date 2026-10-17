import { normalizar } from './texto';

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const TELEFONO_VALIDO = /^\+?[0-9]{8,15}$/;
const limpiar = (valor) => (typeof valor === 'string' ? valor.trim() : '');

/**
 * Valida el formulario público de postulación ("Trabaja con nosotros").
 * @returns {Object} mensajes de error por campo (vacío si es válido).
 */
export function validarPostulacion(datos = {}) {
  const errores = {};
  const nombre = limpiar(datos.nombre);
  const correo = limpiar(datos.correo);
  const telefono = limpiar(datos.telefono).replace(/[\s-]/g, '');

  if (!nombre) errores.nombre = 'Ingresa tu nombre completo.';
  else if (nombre.length < 3) errores.nombre = 'El nombre debe tener al menos 3 caracteres.';

  if (!correo) errores.correo = 'Ingresa tu correo electrónico.';
  else if (!CORREO_VALIDO.test(correo)) errores.correo = 'El correo no tiene un formato válido (ej: nombre@dominio.cl).';

  if (!telefono) errores.telefono = 'Ingresa tu teléfono.';
  else if (!TELEFONO_VALIDO.test(telefono)) errores.telefono = 'El teléfono debe contener solo números (8 a 15 dígitos).';

  if (!limpiar(datos.ciudad)) errores.ciudad = 'Indica tu ciudad de residencia.';
  if (!datos.origen) errores.origen = 'Indica si trabajas actualmente en AquaChile.';
  if (!datos.cv) errores.cv = 'Adjunta tu currículum.';
  if (!datos.consentimiento) {
    errores.consentimiento = 'Debes aceptar el uso de tus datos para el proceso de selección.';
  }

  return errores;
}

/** Ofertas abiertas, las más recientes primero, filtradas por área y texto. */
export function filtrarOfertas(ofertas = [], { area = '', busqueda = '' } = {}) {
  const texto = normalizar(busqueda.trim());
  return ofertas
    .filter((oferta) => oferta.estado === 'Abierta')
    .filter((oferta) => !area || oferta.area === area)
    .filter(
      (oferta) =>
        !texto ||
        [oferta.titulo, oferta.ubicacion, oferta.region, oferta.area].some((campo) =>
          normalizar(campo ?? '').includes(texto),
        ),
    )
    .sort((a, b) => b.fechaPublicacion.localeCompare(a.fechaPublicacion));
}

/** Postulaciones con su oferta y candidato, filtradas para la bandeja del analista. */
export function filtrarPostulaciones(
  postulaciones = [],
  { ofertas = [], candidatos = [] } = {},
  { ofertaId = '', estado = '', busqueda = '' } = {},
) {
  const texto = normalizar(busqueda.trim());
  return postulaciones
    .map((postulacion) => ({
      ...postulacion,
      oferta: ofertas.find((oferta) => oferta.id === postulacion.ofertaId) ?? null,
      candidato: candidatos.find((candidato) => candidato.id === postulacion.candidatoId) ?? null,
    }))
    .filter((postulacion) => !ofertaId || postulacion.ofertaId === Number(ofertaId))
    .filter((postulacion) => !estado || postulacion.estado === estado)
    .filter(
      (postulacion) =>
        !texto ||
        [postulacion.candidato?.nombre, postulacion.candidato?.correo, postulacion.oferta?.titulo].some(
          (campo) => normalizar(campo ?? '').includes(texto),
        ),
    )
    .sort((a, b) => b.fechaPostulacion.localeCompare(a.fechaPostulacion) || b.id - a.id);
}

/** Cantidad de postulaciones por estado, para los contadores de la bandeja. */
export function resumenPostulaciones(postulaciones = []) {
  return postulaciones.reduce(
    (resumen, postulacion) => ({ ...resumen, [postulacion.estado]: (resumen[postulacion.estado] ?? 0) + 1 }),
    { Recibida: 0, 'En evaluación': 0, Descartada: 0 },
  );
}

/** Ids de candidatos que ya pasaron a evaluación (tienen al menos una solicitud). */
export function idsCandidatosEnEvaluacion(solicitudes = []) {
  return new Set(solicitudes.map((solicitud) => Number(solicitud.candidatoId)));
}

/**
 * Candidatos que puede ver un perfil. El evaluador solo ve a quienes el analista
 * pasó a evaluación; el resto de los perfiles ve a todos los postulantes.
 */
export function candidatosVisibles(candidatos = [], solicitudes = [], { soloEnEvaluacion = false } = {}) {
  if (!soloEnEvaluacion) return candidatos;
  const enEvaluacion = idsCandidatosEnEvaluacion(solicitudes);
  return candidatos.filter((candidato) => enEvaluacion.has(candidato.id));
}
