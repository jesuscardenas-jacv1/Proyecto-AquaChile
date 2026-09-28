import { formatearFecha } from '../../dominio/formateo';
import EtiquetaEstado from '../comunes/EtiquetaEstado';

/**
 * Panel con el detalle de un indicador del dashboard: desgloses por categoría,
 * solicitudes relacionadas y acceso al listado completo.
 */
export default function DetalleIndicador({
  id,
  titulo,
  resumen,
  grupos = [],
  solicitudes = [],
  textoListado,
  alVerListado,
  alAbrirSolicitud,
  alCerrar,
}) {
  return (
    <section id={id} className="card border-0 shadow-sm" aria-label={`Detalle: ${titulo}`}>
      <div className="card-header bg-white d-flex justify-content-between align-items-center gap-2">
        <div>
          <h2 className="h6 mb-0">{titulo}</h2>
          {resumen ? <small className="text-secondary">{resumen}</small> : null}
        </div>
        <button type="button" className="btn-close" aria-label="Cerrar detalle" onClick={alCerrar} />
      </div>

      <div className="card-body">
        <div className="row g-4">
          {grupos.map((grupo) => {
            const total = grupo.filas.reduce((suma, fila) => suma + fila.total, 0) || 1;
            return (
              <div key={grupo.titulo} className="col-12 col-md-6 col-xl-4">
                <h3 className="h6 text-secondary">{grupo.titulo}</h3>
                {grupo.filas.length === 0 ? (
                  <p className="small text-secondary mb-0">Sin datos.</p>
                ) : (
                  <ul className="list-unstyled mb-0">
                    {grupo.filas.map((fila) => (
                      <li key={fila.etiqueta} className="mb-2">
                        <div className="d-flex justify-content-between small">
                          <span>{fila.etiqueta}</span>
                          <span className="text-secondary">
                            {fila.total} · {Math.round((fila.total / total) * 100)}%
                          </span>
                        </div>
                        <div className="progress progress-delgada" aria-hidden="true">
                          <div
                            className="progress-bar"
                            style={{ width: `${(fila.total / total) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          {solicitudes.length > 0 ? (
            <div className="col-12 col-xl-4">
              <h3 className="h6 text-secondary">Últimas solicitudes</h3>
              <div className="list-group list-group-flush">
                {solicitudes.map((solicitud) => (
                  <button
                    key={solicitud.id}
                    type="button"
                    className="list-group-item list-group-item-action px-0 d-flex justify-content-between align-items-center gap-2"
                    onClick={() => alAbrirSolicitud(solicitud)}
                  >
                    <span>
                      <span className="d-block small fw-semibold">{solicitud.nombreCandidato}</span>
                      <span className="d-block small text-secondary">
                        {solicitud.cargo} · {formatearFecha(solicitud.fechaSolicitud)}
                      </span>
                    </span>
                    <EtiquetaEstado valor={solicitud.estado} />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {textoListado ? (
        <div className="card-footer bg-white d-flex justify-content-end">
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={alVerListado}>
            {textoListado}
            <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </section>
  );
}
