import { useState } from 'react';
import { Link } from 'react-router-dom';

/** Cantidad de tareas completadas que se muestran dentro del Planner. */
export const COMPLETADAS_VISIBLES = 5;

/**
 * Columna (etapa) del Planner. La columna "Informe enviado" agrupa las tareas
 * completadas en una sección colapsable, como en Microsoft Planner: muestra solo
 * las más recientes y enlaza a la pantalla "Informes enviados" con el historial completo.
 */
export default function ColumnaPlanner({ etapa, cantidad, completadas = false, enlaceVerTodos, children }) {
  const [abierta, setAbierta] = useState(true);
  const tarjetas = Array.isArray(children) ? children : [children].filter(Boolean);
  const idLista = `planner-lista-${etapa.id}`;

  const lista = completadas ? tarjetas.slice(0, COMPLETADAS_VISIBLES) : tarjetas;
  const restantes = tarjetas.length - lista.length;

  return (
    <section className={`planner-columna planner-columna-${etapa.id} h-100`} aria-labelledby={`${idLista}-titulo`}>
      <header className="planner-columna-cabecera d-flex align-items-center justify-content-between gap-2">
        <h2 id={`${idLista}-titulo`} className="h6 mb-0 d-flex align-items-center gap-2">
          <i className={`bi ${etapa.icono}`} aria-hidden="true" />
          {etapa.titulo}
        </h2>
        <span className="planner-contador" aria-label={`${cantidad} solicitudes`}>
          {cantidad}
        </span>
      </header>

      {completadas ? (
        <button
          type="button"
          className="btn btn-link btn-sm text-decoration-none px-0 d-flex align-items-center gap-1 mb-2"
          aria-expanded={abierta}
          aria-controls={idLista}
          onClick={() => setAbierta((valor) => !valor)}
        >
          <i className={`bi ${abierta ? 'bi-chevron-up' : 'bi-chevron-down'}`} aria-hidden="true" />
          Tareas completadas
          <span className="ms-1 text-secondary">{cantidad}</span>
        </button>
      ) : null}

      {abierta ? (
        <div id={idLista} className="d-flex flex-column gap-2">
          {lista.length === 0 ? (
            <p className="small text-secondary text-center py-4 mb-0 planner-columna-vacia">
              Sin solicitudes en esta etapa.
            </p>
          ) : (
            lista
          )}

          {completadas && enlaceVerTodos && tarjetas.length > 0 ? (
            <Link to={enlaceVerTodos} className="btn btn-primary btn-sm d-flex align-items-center justify-content-center gap-2">
              <i className="bi bi-grid-3x3-gap" aria-hidden="true" />
              Ver todos los informes
              {restantes > 0 ? (
                <span className="badge bg-white text-primary">+{restantes}</span>
              ) : null}
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
