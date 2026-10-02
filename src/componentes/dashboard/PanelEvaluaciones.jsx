import { useState } from 'react';
import {
  TIPOS_EVALUACION,
  etiquetaMes,
  filtrarRegistros,
  mesesDisponibles,
  porCategoria,
  porFamiliaYTipo,
  porMesYTipo,
  porReclutador,
  promedioTiming,
  registrosEvaluados,
} from '../../dominio/indicadoresEvaluacion';
import {
  COLORES_CATEGORIA,
  COLORES_TIPO,
  GraficoBarrasApiladas,
  GraficoColumnasApiladas,
  GraficoDona,
  Leyenda,
  Medidor,
} from './Graficos';

const LEYENDA_TIPO = TIPOS_EVALUACION.map((tipo) => ({
  etiqueta: tipo,
  color: COLORES_TIPO[tipo],
}));

function Tarjeta({ titulo, subtitulo, leyenda, children, className = '' }) {
  return (
    <section className={`card border-0 shadow-sm h-100 ${className}`.trim()} aria-label={titulo}>
      <div className="card-body d-flex flex-column gap-3">
        <div>
          <h3 className="h6 mb-1">{titulo}</h3>
          {subtitulo ? <p className="small text-secondary mb-0">{subtitulo}</p> : null}
        </div>
        {leyenda}
        <div className="flex-grow-1">{children}</div>
      </div>
    </section>
  );
}

/**
 * Indicadores de candidatos/as evaluados/as (réplica del dashboard de Power BI):
 * categoría, familia de cargo, reclutador/a, evaluaciones por mes y timing promedio,
 * con filtros por mes y por tipo de evaluación que aplican a todos los gráficos.
 */
export default function PanelEvaluaciones({ solicitudes, evaluaciones }) {
  const [filtros, setFiltros] = useState({ mes: '', tipo: '' });

  const todos = registrosEvaluados(solicitudes, evaluaciones);
  const registros = filtrarRegistros(todos, filtros);
  const meses = mesesDisponibles(todos);
  const reclutadores = porReclutador(registros);
  const timing = promedioTiming(registros);

  const cambiarFiltro = (evento) => {
    const { name, value } = evento.target;
    setFiltros((actual) => ({ ...actual, [name]: value }));
  };

  return (
    <section className="d-flex flex-column gap-3" aria-labelledby="titulo-evaluaciones">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-end gap-3">
        <div>
          <h2 id="titulo-evaluaciones" className="h5 mb-1">
            Candidatos evaluados
          </h2>
          <p className="text-secondary small mb-0">
            {registros.length} {registros.length === 1 ? 'evaluación' : 'evaluaciones'} con
            resultado{filtros.mes || filtros.tipo ? ' para los filtros seleccionados' : ''}.
          </p>
        </div>
        <div className="d-flex flex-column flex-sm-row gap-2">
          <div>
            <label className="form-label small mb-1" htmlFor="filtro-mes">
              Filtrar por mes
            </label>
            <select
              id="filtro-mes"
              name="mes"
              className="form-select form-select-sm"
              value={filtros.mes}
              onChange={cambiarFiltro}
            >
              <option value="">Todos</option>
              {meses.map((mes) => (
                <option key={mes} value={mes}>
                  {etiquetaMes(mes)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label small mb-1" htmlFor="filtro-tipo">
              Filtrar por tipo de evaluación
            </label>
            <select
              id="filtro-tipo"
              name="tipo"
              className="form-select form-select-sm"
              value={filtros.tipo}
              onChange={cambiarFiltro}
            >
              <option value="">Todas</option>
              {TIPOS_EVALUACION.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-5">
          <Tarjeta titulo="Categoría de candidatos evaluados">
            <GraficoDona
              titulo="Categoría de candidatos evaluados"
              datos={porCategoria(registros)}
              colores={COLORES_CATEGORIA}
            />
          </Tarjeta>
        </div>
        <div className="col-12 col-xl-7">
          <Tarjeta
            titulo="Recuento de candidatos evaluados por familia de cargo"
            leyenda={<Leyenda titulo="Tipo de evaluación" elementos={LEYENDA_TIPO} />}
          >
            <GraficoBarrasApiladas
              titulo="Recuento de candidatos evaluados por familia de cargo"
              etiquetaFilas="Familia del cargo"
              datos={porFamiliaYTipo(registros)}
            />
          </Tarjeta>
        </div>

        <div className="col-12 col-md-6 col-xl-4">
          <Tarjeta titulo="Candidatos evaluados por reclutador">
            {reclutadores.length === 0 ? (
              <p className="text-secondary small mb-0">
                Sin evaluaciones para los filtros seleccionados.
              </p>
            ) : (
              <div className="table-responsive tabla-reclutadores">
                <table className="table table-sm mb-0 small">
                  <thead className="table-light">
                    <tr>
                      <th scope="col">Reclutador/a</th>
                      <th scope="col" className="text-end">
                        Evaluados
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reclutadores.map(({ etiqueta, total }) => (
                      <tr key={etiqueta}>
                        <td>{etiqueta}</td>
                        <td className="text-end tabular">{total}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="fw-semibold">
                      <td>Total</td>
                      <td className="text-end tabular">{registros.length}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Tarjeta>
        </div>
        <div className="col-12 col-md-6 col-xl-5">
          <Tarjeta
            titulo="Candidatos evaluados por mes"
            leyenda={<Leyenda titulo="Tipo de evaluación" elementos={LEYENDA_TIPO} />}
          >
            <GraficoColumnasApiladas
              titulo="Candidatos evaluados por mes"
              etiquetaColumnas="Mes"
              datos={porMesYTipo(registros)}
              formatearEtiqueta={etiquetaMes}
            />
          </Tarjeta>
        </div>
        <div className="col-12 col-xl-3">
          <Tarjeta
            titulo="Promedio de timing"
            subtitulo="Promedio de días hábiles desde la solicitud hasta el envío del informe."
          >
            <Medidor valor={timing} unidad="días hábiles" descripcion="Promedio de timing" />
          </Tarjeta>
        </div>
      </div>
    </section>
  );
}
