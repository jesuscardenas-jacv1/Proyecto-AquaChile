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

/** Cargo con descriptor guardado en el sistema, o null. */
export const buscarCargoGuardado = (nombre, cargosGuardados = []) =>
  buscarEn(cargosGuardados, nombre);

/**
 * De dónde sale el descriptor de un cargo, en orden: el guardado para ese cargo, el que una
 * oferta antigua subió por su cuenta o el PDF de demostración del catálogo.
 * @returns {{ nombre: string, origen: 'cargo'|'oferta'|'catalogo'|'', cargoGuardado?: Object }}
 */
export function resolverDescriptor({ cargo, cargosGuardados = [], oferta = null } = {}) {
  const cargoGuardado = buscarCargoGuardado(cargo, cargosGuardados);
  if (cargoGuardado?.descriptorNombre) {
    return { nombre: cargoGuardado.descriptorNombre, origen: 'cargo', cargoGuardado };
  }
  if (oferta?.descriptorNombre && normalizar(oferta.cargo ?? '') === normalizar(cargo?.trim() ?? '')) {
    return { nombre: oferta.descriptorNombre, origen: 'oferta' };
  }
  const catalogo = buscarCargo(cargo)?.descriptorCargo;
  return catalogo ? { nombre: catalogo, origen: 'catalogo' } : { nombre: '', origen: '' };
}

/** Datos conocidos de un cargo (familia), mirando primero los guardados en el sistema. */
export const datosDeCargo = (nombre, cargosGuardados = []) =>
  buscarCargoGuardado(nombre, cargosGuardados) ?? buscarCargo(nombre);

/** Nombres para autocompletar: el catálogo y los cargos creados en el sistema. */
export function nombresDeCargos(cargosGuardados = []) {
  const nombres = new Map(CARGOS.map(({ nombre }) => [normalizar(nombre), nombre]));
  cargosGuardados.forEach(({ nombre }) => {
    if (!nombres.has(normalizar(nombre))) nombres.set(normalizar(nombre), nombre);
  });
  return [...nombres.values()].sort((a, b) => a.localeCompare(b, 'es'));
}

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
