import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDatos } from '../datos/DatosContext';
import { RECLUTADORES, RESULTADOS_EVALUACION } from '../datos/constantes';
import {
  etapaDeSolicitud,
  filtrarInformes,
  paginar,
  paginasVisibles,
  resumenResultados,
} from '../dominio/planner';
import EstadoVacio from '../componentes/comunes/EstadoVacio';
import TarjetaInforme from '../componentes/planner/TarjetaInforme';

export const INFORMES_POR_PAGINA = 12;

const ESTILO_RESULTADO = {
  Recomendado: { variante: 'success', icono: 'bi-check-circle' },
  'Recomendado con observaciones': { variante: 'warning', icono: 'bi-exclamation-circle' },
  'No recomendado': { variante: 'danger', icono: 'bi-x-circle' },
};

const ORDENES = [
  { valor: 'recientes', etiqueta: 'Más recientes' },
  { valor: 'antiguos', etiqueta: 'Más antiguos' },
  { valor: 'nombre', etiqueta: 'Nombre (A-Z)' },
];

/**
 * Pantalla con todos los informes enviados (columna final del Planner) en una grilla
 * ordenada fila por fila, con resumen por resultado, filtros, orden y paginación.
 * Los filtros y la página viven en la URL: al abrir un informe y volver, se mantiene la vista.
 */
export default function InformesEnviados() {
  const { solicitudes, candidatos, evaluaciones } = useDatos();
  const [parametros, setParametros] = useSearchParams();

  const criterios = {
    texto: parametros.get('q') ?? '',
    resultado: RESULTADOS_EVALUACION.includes(parametros.get('resultado')) ? parametros.get('resultado') : '',
    solicitante: RECLUTADORES.includes(parametros.get('solicitante')) ? parametros.get('solicitante') : '',
    orden: ORDENES.some(({ valor }) => valor === parametros.get('orden')) ? parametros.get('orden') : 'recientes',
  };

  const informes = useMemo(() => {
    const candidatosPorId = Object.fromEntries(candidatos.map((candidato) => [candidato.id, candidato]));
    const evaluacionesPorSolicitud = Object.fromEntries(
      evaluaciones.map((evaluacion) => [evaluacion.solicitudId, evaluacion]),
    );
    return solicitudes
      .filter((solicitud) => etapaDeSolicitud(solicitud) === 'informe')
      .map((solicitud) => ({
        solicitud,
        candidato: candidatosPorId[solicitud.candidatoId],
        evaluacion: evaluacionesPorSolicitud[solicitud.id],
      }));
  }, [solicitudes, candidatos, evaluaciones]);

  const resumen = useMemo(() => resumenResultados(informes, RESULTADOS_EVALUACION), [informes]);
  const filtrados = filtrarInformes(informes, criterios);
  const pagina = paginar(filtrados, parametros.get('pagina'), INFORMES_POR_PAGINA);
  const hayFiltros = Boolean(criterios.texto || criterios.resultado || criterios.solicitante);

  /** Cambia un filtro en la URL y vuelve a la página 1. */
  const cambiar = (clave, valor) => {
    setParametros(
      (actuales) => {
        const nuevos = new URLSearchParams(actuales);
        if (valor) nuevos.set(clave, valor);
        else nuevos.delete(clave);
        if (clave !== 'pagina') nuevos.delete('pagina');
        return nuevos;
      },
      { replace: clave !== 'pagina' },
    );
  };

  const irAPagina = (numero) => {
    cambiar('pagina', numero > 1 ? String(numero) : '');
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="d-flex flex-column gap-3">
      <nav aria-label="miga de pan">
        <ol className="breadcrumb mb-0 small">
          <li className="breadcrumb-item">
            <Link to="/planner">Planner</Link>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            Informes enviados
          </li>
        </ol>
      </nav>

      <header className="d-flex flex-column flex-md-row justify-content-between gap-2 align-items-md-center">
        <div>
          <h1 className="h4 mb-1">Informes enviados</h1>
          <p className="text-secondary mb-0">
            {informes.length} evaluaciones finalizadas con su informe psicolaboral enviado al analista.
          </p>
        </div>
        <Link to="/planner" className="btn btn-outline-primary align-self-start align-self-md-center">
          <i className="bi bi-kanban me-1" aria-hidden="true" />
          Volver al Planner
        </Link>
      </header>

      <section aria-label="Resumen por resultado" className="row g-3">
        {RESULTADOS_EVALUACION.map((resultado) => {
          const { variante, icono } = ESTILO_RESULTADO[resultado];
          const activo = criterios.resultado === resultado;
          return (
            <div key={resultado} className="col-12 col-md-4">
              <button
                type="button"
                className={`card border-0 border-start border-4 border-${variante} shadow-sm w-100 text-start tarjeta-indicador ${
                  activo ? 'tarjeta-indicador-activa' : ''
                }`.trim()}
                aria-pressed={activo}
                onClick={() => cambiar('resultado', activo ? '' : resultado)}
              >
                <span className="card-body d-flex align-items-center gap-3 py-3">
                  <span className={`rounded-circle bg-${variante} bg-opacity-10 text-${variante} p-2 lh-1`}>
                    <i className={`bi ${icono} fs-5`} aria-hidden="true" />
                  </span>
                  <span className="flex-grow-1">
                    <span className="d-block small text-secondary">{resultado}</span>
                    <span className="d-block h5 mb-0 fw-semibold">{resumen[resultado]}</span>
                  </span>
                  {activo ? <span className="badge bg-primary">Filtrando</span> : null}
                </span>
              </button>
            </div>
          );
        })}
      </section>

      <section className="card border-0 shadow-sm" aria-label="Filtros de informes">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-lg-4">
              <label className="form-label small text-secondary mb-1" htmlFor="informes-busqueda">
                Buscar
              </label>
              <div className="input-group">
                <span className="input-group-text bg-white">
                  <i className="bi bi-search" aria-hidden="true" />
                </span>
                <input
                  id="informes-busqueda"
                  type="search"
                  className="form-control"
                  placeholder="Candidato, cargo, ubicación o N°"
                  value={criterios.texto}
                  onChange={(evento) => cambiar('q', evento.target.value)}
                />
              </div>
            </div>
            <div className="col-12 col-sm-6 col-lg-3">
              <label className="form-label small text-secondary mb-1" htmlFor="informes-resultado">
                Resultado
              </label>
              <select
                id="informes-resultado"
                className="form-select"
                value={criterios.resultado}
                onChange={(evento) => cambiar('resultado', evento.target.value)}
              >
                <option value="">Todos los resultados</option>
                {RESULTADOS_EVALUACION.map((resultado) => (
                  <option key={resultado} value={resultado}>
                    {resultado}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-sm-6 col-lg-3">
              <label className="form-label small text-secondary mb-1" htmlFor="informes-solicitante">
                Solicitado por
              </label>
              <select
                id="informes-solicitante"
                className="form-select"
                value={criterios.solicitante}
                onChange={(evento) => cambiar('solicitante', evento.target.value)}
              >
                <option value="">Todos los reclutadores/as</option>
                {RECLUTADORES.map((nombre) => (
                  <option key={nombre} value={nombre}>
                    {nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-lg-2">
              <label className="form-label small text-secondary mb-1" htmlFor="informes-orden">
                Ordenar
              </label>
              <select
                id="informes-orden"
                className="form-select"
                value={criterios.orden}
                onChange={(evento) => cambiar('orden', evento.target.value === 'recientes' ? '' : evento.target.value)}
              >
                {ORDENES.map(({ valor, etiqueta }) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <p className="text-secondary small mb-0" aria-live="polite">
          {filtrados.length === 0
            ? 'Sin resultados'
            : `Mostrando ${pagina.desde}–${pagina.hasta} de ${filtrados.length} informe${filtrados.length === 1 ? '' : 's'}`}
        </p>
        {hayFiltros ? (
          <button
            type="button"
            className="btn btn-link btn-sm px-0"
            onClick={() => setParametros(criterios.orden !== 'recientes' ? { orden: criterios.orden } : {})}
          >
            <i className="bi bi-x-circle me-1" aria-hidden="true" />
            Limpiar filtros
          </button>
        ) : null}
      </div>

      {filtrados.length === 0 ? (
        <div className="card border-0 shadow-sm">
          <EstadoVacio
            titulo="No hay informes que coincidan"
            descripcion="Prueba con otro texto o quita alguno de los filtros."
            icono="bi-search"
          />
        </div>
      ) : (
        <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-4 g-3">
          {pagina.elementos.map(({ solicitud, candidato, evaluacion }) => (
            <div key={solicitud.id} className="col">
              <TarjetaInforme solicitud={solicitud} candidato={candidato} evaluacion={evaluacion} />
            </div>
          ))}
        </div>
      )}

      {pagina.totalPaginas > 1 ? (
        <nav aria-label="Páginas de informes" className="d-flex justify-content-center">
          <ul className="pagination mb-0 flex-wrap">
            <li className={`page-item ${pagina.pagina === 1 ? 'disabled' : ''}`}>
              <button
                type="button"
                className="page-link"
                aria-label="Página anterior"
                disabled={pagina.pagina === 1}
                onClick={() => irAPagina(pagina.pagina - 1)}
              >
                <i className="bi bi-chevron-left" aria-hidden="true" />
              </button>
            </li>
            {paginasVisibles(pagina.pagina, pagina.totalPaginas).map((numero, indice) =>
              numero === '…' ? (
                <li key={`salto-${indice}`} className="page-item disabled">
                  <span className="page-link">…</span>
                </li>
              ) : (
                <li key={numero} className={`page-item ${numero === pagina.pagina ? 'active' : ''}`}>
                  <button
                    type="button"
                    className="page-link"
                    aria-label={`Página ${numero}`}
                    aria-current={numero === pagina.pagina ? 'page' : undefined}
                    onClick={() => irAPagina(numero)}
                  >
                    {numero}
                  </button>
                </li>
              ),
            )}
            <li className={`page-item ${pagina.pagina === pagina.totalPaginas ? 'disabled' : ''}`}>
              <button
                type="button"
                className="page-link"
                aria-label="Página siguiente"
                disabled={pagina.pagina === pagina.totalPaginas}
                onClick={() => irAPagina(pagina.pagina + 1)}
              >
                <i className="bi bi-chevron-right" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
