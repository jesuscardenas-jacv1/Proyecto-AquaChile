import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatearFecha } from '../../dominio/formateo';

/**
 * Grupo plegable del Planner con las solicitudes cerradas sin evaluación: motivo, fecha
 * y quién la cerró. La psicóloga puede reabrirlas (vuelven a la etapa en que estaban).
 */
export default function ListaCerradas({ solicitudes = [], candidatosPorId = {}, editable = false, alReabrir }) {
  const [abierta, setAbierta] = useState(false);
  if (solicitudes.length === 0) return null;

  return (
    <section className="card border-0 shadow-sm" aria-labelledby="planner-cerradas-titulo">
      <div className="card-header bg-white">
        <button
          type="button"
          className="btn btn-link text-decoration-none p-0 d-flex align-items-center gap-2"
          aria-expanded={abierta}
          aria-controls="planner-cerradas"
          onClick={() => setAbierta((valor) => !valor)}
        >
          <i className={`bi ${abierta ? 'bi-chevron-up' : 'bi-chevron-down'}`} aria-hidden="true" />
          <span id="planner-cerradas-titulo" className="h6 mb-0">
            Cerradas sin informe
          </span>
          <span className="badge bg-secondary-subtle text-secondary-emphasis">{solicitudes.length}</span>
        </button>
      </div>
      {abierta ? (
        <ul id="planner-cerradas" className="list-group list-group-flush">
          {solicitudes.map((solicitud) => {
            const nombre = candidatosPorId[solicitud.candidatoId]?.nombre ?? 'Candidato eliminado';
            return (
              <li key={solicitud.id} className="list-group-item d-flex flex-wrap align-items-center gap-2">
                <div className="flex-grow-1">
                  <Link to={`/solicitudes/${solicitud.id}`} className="fw-semibold text-decoration-none">
                    {nombre}
                  </Link>{' '}
                  <span className="small text-secondary">
                    #{solicitud.id} · {solicitud.cargo}
                  </span>
                  <div className="small">
                    <span className="badge bg-secondary-subtle text-secondary-emphasis me-1">{solicitud.cierre.motivo}</span>
                    <span className="text-secondary">
                      {formatearFecha(solicitud.cierre.fecha)}
                      {solicitud.cierre.responsable ? ` · ${solicitud.cierre.responsable}` : ''}
                    </span>
                  </div>
                  {solicitud.cierre.comentario ? (
                    <div className="small text-secondary">{solicitud.cierre.comentario}</div>
                  ) : null}
                </div>
                {editable ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => alReabrir(solicitud)}
                    aria-label={`Reabrir la solicitud de ${nombre}`}
                  >
                    <i className="bi bi-arrow-counterclockwise me-1" aria-hidden="true" />
                    Reabrir
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
