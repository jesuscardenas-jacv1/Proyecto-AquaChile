import { ESTADOS_SOLICITUD } from '../datos/constantes';
import { ordenarPorFecha } from './consultas';

/**
 * Calcula los indicadores del dashboard a partir de las solicitudes.
 */
export function resumenSolicitudes(solicitudes = [], estados = ESTADOS_SOLICITUD) {
  const porEstado = estados.reduce((acumulado, estado) => {
    acumulado[estado] = 0;
    return acumulado;
  }, {});

  solicitudes.forEach((solicitud) => {
    if (porEstado[solicitud.estado] === undefined) {
      porEstado[solicitud.estado] = 0;
    }
    porEstado[solicitud.estado] += 1;
  });

  const total = solicitudes.length;
  const finalizadas = porEstado.Finalizada ?? 0;

  return {
    total,
    porEstado,
    finalizadas,
    porcentajeFinalizadas: total === 0 ? 0 : Math.round((finalizadas / total) * 100),
  };
}

/** Cuenta solicitudes agrupadas por familia de cargo. */
export function solicitudesPorFamilia(solicitudes = []) {
  const conteo = solicitudes.reduce((acumulado, solicitud) => {
    const familia = solicitud.familiaCargo || 'Sin familia';
    acumulado[familia] = (acumulado[familia] ?? 0) + 1;
    return acumulado;
  }, {});

  return Object.entries(conteo)
    .map(([familia, total]) => ({ familia, total }))
    .sort((a, b) => b.total - a.total);
}

/** Devuelve las n solicitudes más recientes ordenadas por fecha. */
export function solicitudesRecientes(solicitudes = [], cantidad = 5) {
  return ordenarPorFecha(solicitudes).slice(0, cantidad);
}

/**
 * Regla de negocio: una solicitud pasa a "Finalizada" cuando la evaluación
 * tiene resultado; si solo hay registro sin resultado queda "En proceso".
 */
export function estadoSolicitudDesdeEvaluacion(evaluacion) {
  if (!evaluacion) return 'En proceso';
  return evaluacion.resultado ? 'Finalizada' : 'En proceso';
}
