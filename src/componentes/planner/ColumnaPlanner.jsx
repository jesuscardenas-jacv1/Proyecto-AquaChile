import { useState } from 'react';

const TAMANO_PAGINA = 8;

/**
 * Columna (etapa) del Planner. La columna "Informe enviado" agrupa las tareas
 * completadas en una sección colapsable y paginada, como en Microsoft Planner,
 * para que el historial no ocupe toda la pantalla.
 */
export default function ColumnaPlanner({ etapa, cantidad, completadas = false, children }) {
  const [abierta, setAbierta] = useState(true);
  const [visibles, setVisibles] = useState(TAMANO_PAGINA);
  const tarjetas = Array.isArray(children) ? children : [children].filter(Boolean);
  const idLista = `planner-lista-${etapa.id}`;

  const lista = completadas ? tarjetas.slice(0, visibles) : tarjetas;

  return (
    <section className={`planner-columna planner-columna-${etapa.id} h-100`} aria-labelledby={`${idLista}-titulo`}>
      <header className="planner-columna-cabecera d-flex align-items-center justify-content-between gap-2">
        <h2 id={`${idLista}-titulo`} className="h6 mb-0 d-flex align-items-center gap-2">
          <i className={`bi ${etapa.icono}`} aria-hidden="true" />
          {etapa.titulo}
        </h2>
        <span className="badge rounded-pill bg-white text-primary border" aria-label={`${cantidad} solicitudes`}>
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

          {completadas && tarjetas.length > visibles ? (
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={() => setVisibles((valor) => valor + TAMANO_PAGINA)}
            >
              Mostrar más ({tarjetas.length - visibles} restantes)
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
