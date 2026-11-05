import { normalizar } from './texto';

/** Estados de una oferta: un borrador no se ve en el portal; "Abierta" es la publicada. */
export const ESTADOS_OFERTA = ['Borrador', 'Abierta', 'Cerrada'];
export const JORNADAS_OFERTA = ['Jornada completa', 'Jornada parcial', 'Turnos rotativos', 'Práctica'];

const limpiar = (valor) => (typeof valor === 'string' ? valor.trim() : '');

export const fechaDeHoy = () => new Date().toISOString().slice(0, 10);

/**
 * Valida una oferta. Un borrador solo necesita título; para publicarla (o editar una ya
 * publicada) deben estar todos los datos que verá el postulante.
 * @returns {Object} mensajes de error por campo (vacío si es válida).
 */
export function validarOferta(oferta = {}, { completa = false } = {}) {
  const errores = {};
  if (limpiar(oferta.titulo).length < 3) errores.titulo = 'El título debe tener al menos 3 caracteres.';
  if (!completa) return errores;

  if (!limpiar(oferta.area)) errores.area = 'Selecciona el área.';
  if (!limpiar(oferta.cargo)) errores.cargo = 'Indica el cargo.';
  if (!limpiar(oferta.familiaCargo)) errores.familiaCargo = 'Selecciona la familia de cargo.';
  if (!limpiar(oferta.ubicacion)) errores.ubicacion = 'Indica la ubicación.';
  if (!limpiar(oferta.region)) errores.region = 'Indica la región.';
  if (!limpiar(oferta.descripcion)) errores.descripcion = 'Describe el cargo.';
  return errores;
}

/** Convierte el texto del formulario (un requisito por línea) en una lista. */
export function requisitosDesdeTexto(texto = '') {
  return texto
    .split('\n')
    .map((linea) => linea.trim())
    .filter(Boolean);
}

/** Datos del formulario, limpios, tal como se guardan. */
export function normalizarOferta(datos = {}) {
  return {
    titulo: limpiar(datos.titulo),
    area: limpiar(datos.area),
    cargo: limpiar(datos.cargo),
    familiaCargo: limpiar(datos.familiaCargo),
    ubicacion: limpiar(datos.ubicacion),
    region: limpiar(datos.region),
    descripcion: limpiar(datos.descripcion),
    requisitos: datos.requisitos ?? [],
    jornada: limpiar(datos.jornada) || JORNADAS_OFERTA[0],
  };
}

/** Oferta nueva para el modo sin servidor. */
export function crearOferta(id, datos, { publicar = false, fecha = fechaDeHoy() } = {}) {
  return {
    id,
    ...normalizarOferta(datos),
    estado: publicar ? 'Abierta' : 'Borrador',
    fechaPublicacion: publicar ? fecha : '',
  };
}

/** Edición para el modo sin servidor: un borrador puede publicarse al guardar. */
export function aplicarEdicionOferta(actual, datos, { publicar = false, fecha = fechaDeHoy() } = {}) {
  const sePublica = actual.estado === 'Borrador' && publicar;
  return {
    ...actual,
    ...normalizarOferta(datos),
    estado: sePublica ? 'Abierta' : actual.estado,
    fechaPublicacion: actual.fechaPublicacion || (sePublica ? fecha : ''),
  };
}

/** Listado de gestión: borradores primero y luego lo más reciente. */
export function filtrarGestionOfertas(ofertas = [], { estado = '', busqueda = '' } = {}) {
  const texto = normalizar(busqueda.trim());
  const orden = (oferta) => (oferta.estado === 'Borrador' ? 0 : 1);
  return ofertas
    .filter((oferta) => !estado || oferta.estado === estado)
    .filter(
      (oferta) =>
        !texto ||
        [oferta.titulo, oferta.cargo, oferta.area, oferta.ubicacion, oferta.region].some((campo) =>
          normalizar(campo ?? '').includes(texto),
        ),
    )
    .sort(
      (a, b) =>
        orden(a) - orden(b) ||
        (b.fechaPublicacion ?? '').localeCompare(a.fechaPublicacion ?? '') ||
        b.id - a.id,
    );
}

/** Cuántas postulaciones recibió cada oferta, por id de oferta. */
export function contarPostulacionesPorOferta(postulaciones = []) {
  return postulaciones.reduce((cuentas, { ofertaId }) => {
    cuentas[ofertaId] = (cuentas[ofertaId] ?? 0) + 1;
    return cuentas;
  }, {});
}
