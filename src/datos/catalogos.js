import bdSimulada from './bdSimulada.json';
import { normalizar } from '../dominio/texto';

/**
 * Catálogos derivados de la BD simulada para automatizar el formulario de solicitud:
 * cada cargo tiene una familia y un descriptor de cargo, y cada ubicación una unidad.
 */
const ordenar = (lista) => lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

function construirCatalogo(registros, clave, extraer) {
  const porNombre = new Map();
  registros.forEach((registro) => {
    const nombre = registro[clave]?.trim();
    if (nombre && !porNombre.has(normalizar(nombre))) {
      porNombre.set(normalizar(nombre), { nombre, ...extraer(registro) });
    }
  });
  return ordenar([...porNombre.values()]);
}

export const CARGOS = construirCatalogo(bdSimulada.solicitudes, 'cargo', (solicitud) => ({
  familiaCargo: solicitud.familiaCargo,
  descriptorCargo: solicitud.descriptorCargo,
}));

export const UBICACIONES = construirCatalogo(bdSimulada.solicitudes, 'ubicacion', (solicitud) => ({
  unidad: solicitud.unidad,
}));

const buscarEn = (catalogo, nombre) =>
  catalogo.find((item) => normalizar(item.nombre) === normalizar(nombre?.trim())) ?? null;

/** Datos asociados a un cargo del catálogo (familia y descriptor), o null si no existe. */
export const buscarCargo = (nombre) => buscarEn(CARGOS, nombre);

/**
 * Descriptor disponible para una oferta: el que se subió al publicarla o, si no tiene,
 * el asociado a su cargo en el catálogo.
 */
export const descriptorDeOferta = (oferta) =>
  oferta?.descriptorNombre || buscarCargo(oferta?.cargo)?.descriptorCargo || '';

/** Indica si el nombre corresponde a un descriptor del catálogo (hay un PDF de demostración). */
export const esDescriptorCatalogo = (nombre) =>
  Boolean(nombre) && CARGOS.some((cargo) => cargo.descriptorCargo === nombre);

/** Ruta del PDF de demostración de un descriptor del catálogo (en disco va sin tildes). */
export const rutaDescriptorCatalogo = (nombre) =>
  `${import.meta.env.BASE_URL}descriptores/${encodeURIComponent(
    nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
  )}`;

/** Unidad a la que pertenece una ubicación del catálogo, o cadena vacía si no existe. */
export const unidadDeUbicacion = (nombre) => buscarEn(UBICACIONES, nombre)?.unidad ?? '';
