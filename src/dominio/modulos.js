/**
 * Cada módulo de la app tiene su color, para distinguir de un vistazo en qué pantalla se está.
 * El color se aplica como atributo `data-modulo` en la barra lateral y el contenido (estilos.css).
 */

const MODULOS = [
  ['/planner', 'planner'],
  ['/ofertas', 'ofertas'],
  ['/postulaciones', 'postulaciones'],
  ['/candidatos', 'candidatos'],
  ['/solicitudes', 'solicitudes'],
  ['/administracion', 'administracion'],
];

/** Módulo al que pertenece una ruta; el Dashboard es la portada ("/"). */
export function moduloDeRuta(ruta = '/') {
  const encontrado = MODULOS.find(([prefijo]) => ruta === prefijo || ruta.startsWith(`${prefijo}/`));
  return encontrado ? encontrado[1] : 'dashboard';
}
