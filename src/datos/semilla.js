import bdSimulada from './bdSimulada.json';

/**
 * Datos semilla: base de datos simulada de AquaChile (abr-2025 a mar-2026).
 * Se genera desde bd/BD_Simulada_Evaluaciones_Psicolaborales_AquaChile.xlsx
 * con `npm run importar:bd`; no editar bdSimulada.json a mano.
 */
export const datosSemilla = {
  candidatos: bdSimulada.candidatos,
  solicitudes: bdSimulada.solicitudes,
  evaluaciones: bdSimulada.evaluaciones,
};
