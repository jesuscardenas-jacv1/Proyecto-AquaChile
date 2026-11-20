// Imports con extensión: el backend (Node) también carga este módulo.
import { EVALUADORES } from './constantes.js';
import { candidatosDemoPlanner, solicitudesDemoPlanner } from './demoPlanner.js';
import { candidatosDemoPostulaciones, ofertasDemo, postulacionesDemo } from './demoPostulaciones.js';
import { ofertasAquaChile } from './ofertasAquaChile.js';

/**
 * Arma los datos semilla a partir de la BD simulada (bdSimulada.json).
 * Es un módulo sin dependencias del navegador para que el backend siembre SQLite
 * con exactamente los mismos registros que usa el frontend.
 *
 * En el Excel la columna "Reclutador/a" quedó como profesionalResponsable: aquí pasa a
 * `reclutador` y la profesional responsable es la psicóloga evaluadora (repartida en orden).
 */
export function construirSemilla(bdSimulada) {
  const solicitudesHistoricas = bdSimulada.solicitudes.map(({ profesionalResponsable, ...solicitud }) => ({
    ...solicitud,
    reclutador: profesionalResponsable ?? '',
    profesionalResponsable: EVALUADORES.at(solicitud.id % EVALUADORES.length),
  }));

  return {
    candidatos: [...bdSimulada.candidatos, ...candidatosDemoPlanner, ...candidatosDemoPostulaciones],
    solicitudes: [...solicitudesHistoricas, ...solicitudesDemoPlanner],
    evaluaciones: bdSimulada.evaluaciones,
    // Las ofertas ficticias quedan cerradas (conservan sus postulaciones de ejemplo) y el portal
    // muestra las ofertas reales del portal de empleo de AquaChile.
    ofertas: [...ofertasDemo.map((oferta) => ({ ...oferta, estado: 'Cerrada' })), ...ofertasAquaChile],
    postulaciones: postulacionesDemo,
  };
}
