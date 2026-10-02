import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { formatearFecha } from '../../dominio/formateo';
import EtiquetaEstado from '../comunes/EtiquetaEstado';

const SELECTOR_ENFOCABLES =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Ventana emergente con el detalle de un indicador del dashboard: desgloses por
 * categoría, solicitudes relacionadas y acceso al listado completo.
 * Se cierra con el botón, la tecla Escape o un clic fuera del contenido.
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
  const refDialogo = useRef(null);
  const refCerrar = useRef(alCerrar);
  refCerrar.current = alCerrar;

  useEffect(() => {
    const enfocadoAntes = document.activeElement;
    document.body.classList.add('modal-open');
    refDialogo.current?.focus();

    const alPresionarTecla = (evento) => {
      if (evento.key === 'Escape') {
        refCerrar.current();
        return;
      }
      if (evento.key !== 'Tab' || !refDialogo.current) return;
      // Mantiene el foco dentro de la ventana mientras está abierta.
      const enfocables = [...refDialogo.current.querySelectorAll(SELECTOR_ENFOCABLES)];
      if (enfocables.length === 0) return;
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (
        evento.shiftKey &&
        (document.activeElement === primero || document.activeElement === refDialogo.current)
      ) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', alPresionarTecla);

    return () => {
      document.removeEventListener('keydown', alPresionarTecla);
      document.body.classList.remove('modal-open');
      enfocadoAntes?.focus?.();
    };
  }, []);

  const idTitulo = `${id}-titulo`;

  return createPortal(
    <>
      <div
        id={id}
        ref={refDialogo}
        className="modal d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        onMouseDown={(evento) => {
          if (evento.target === evento.currentTarget) alCerrar();
        }}
      >
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <section className="modal-content border-0 shadow">
            <div className="modal-header d-flex justify-content-between align-items-center gap-2">
              <div>
                <h2 id={idTitulo} className="h5 mb-0">
                  <span className="visually-hidden">Detalle: </span>
                  {titulo}
                </h2>
                {resumen ? <small className="text-secondary">{resumen}</small> : null}
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Cerrar detalle"
                onClick={alCerrar}
              />
            </div>

            <div className="modal-body">
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
                            <span className="d-block small fw-semibold">
                              {solicitud.nombreCandidato}
                            </span>
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
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={alVerListado}
                >
                  {textoListado}
                  <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>,
    document.body,
  );
}
