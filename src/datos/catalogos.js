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

/** Unidad a la que pertenece una ubicación del catálogo, o cadena vacía si no existe. */
export const unidadDeUbicacion = (nombre) => buscarEn(UBICACIONES, nombre)?.unidad ?? '';
