import { normalizar } from './texto';

const coincideTexto = (solicitud, texto, candidatosPorId) => {
  if (!texto) return true;
  const candidato = candidatosPorId[solicitud.candidatoId];
  const objetivo = normalizar(
    [
      solicitud.cargo,
      solicitud.familiaCargo,
      solicitud.estado,
      solicitud.profesionalResponsable,
      solicitud.observaciones,
      candidato ? candidato.nombre : '',
    ].join(' '),
  );
  return objetivo.includes(normalizar(texto));
};

/**
 * Filtra las solicitudes por texto libre, estado y familia de cargo.
 * @param {Array} solicitudes
 * @param {Object} criterios { texto, estado, familiaCargo }
 * @param {Array} candidatos lista de candidatos (para buscar por nombre)
 */
export function filtrarSolicitudes(solicitudes = [], criterios = {}, candidatos = []) {
  const { texto = '', estado = '', familiaCargo = '' } = criterios;
  const candidatosPorId = candidatos.reduce(
    (acumulado, candidato) => ({ ...acumulado, [candidato.id]: candidato }),
    {},
  );

  return solicitudes.filter((solicitud) => {
    if (estado && solicitud.estado !== estado) return false;
    if (familiaCargo && solicitud.familiaCargo !== familiaCargo) return false;
    return coincideTexto(solicitud, texto, candidatosPorId);
  });
}

/** Filtra candidatos por texto libre (nombre, correo o cargo). */
export function filtrarCandidatos(candidatos = [], texto = '') {
  if (!texto) return candidatos;
  return candidatos.filter((candidato) =>
    normalizar(
      [candidato.nombre, candidato.correo, candidato.cargo, candidato.familiaCargo].join(' '),
    ).includes(normalizar(texto)),
  );
}

/** Devuelve las solicitudes ordenadas de la más reciente a la más antigua. */
export function ordenarPorFecha(solicitudes = []) {
  return [...solicitudes].sort((a, b) => {
    if (a.fechaSolicitud === b.fechaSolicitud) return (b.id ?? 0) - (a.id ?? 0);
    return a.fechaSolicitud < b.fechaSolicitud ? 1 : -1;
  });
}
