/**
 * Solicitudes ficticias en curso para la demostración del Planner de la psicóloga.
 * Todos los nombres, correos y teléfonos son inventados (regla de datos ficticios del caso).
 * Los ids parten en 101 para no chocar con los 100 registros de la BD simulada.
 *
 * Los datos viven en demoPlanner.json para que el backend (backend/src/bd/semilla.js)
 * siembre exactamente las mismas solicitudes en SQLite.
 */
import demoPlanner from './demoPlanner.json';

export const candidatosDemoPlanner = demoPlanner.candidatos;

export const solicitudesDemoPlanner = demoPlanner.solicitudes;
