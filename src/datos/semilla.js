import bdSimulada from './bdSimulada.json';
import { construirSemilla } from './semillaBase';

/**
 * Datos semilla: base de datos simulada de AquaChile (abr-2025 a mar-2026).
 * Se genera desde bd/BD_Simulada_Evaluaciones_Psicolaborales_AquaChile.xlsx
 * con `npm run importar:bd`; no editar bdSimulada.json a mano.
 *
 * Como todas las solicitudes del Excel ya están finalizadas, se suman algunas
 * solicitudes ficticias en curso (demoPlanner.js) para que el Planner de la
 * psicóloga muestre tarjetas en todas sus etapas, y ofertas con postulaciones
 * recibidas del portal "Trabaja con nosotros" (demoPostulaciones.js).
 * El backend siembra SQLite con la misma función (semillaBase.js).
 */
export const datosSemilla = construirSemilla(bdSimulada);
