import { useCallback, useEffect, useState } from 'react';
import { apiAdmin } from '../../servicios/api';
import {
  formatearDuracion,
  formatearNumero,
  formatearTokens,
  formatearUsd,
  nombreTarea,
  porcentajeCuota,
  rangoMesActual,
} from '../../dominio/usoIa';
import Mensaje from '../comunes/Mensaje';

function Indicador({ titulo, valor, detalle }) {
  return (
    <div className="col-6 col-lg-3">
      <div className="border rounded p-2 h-100">
        <div className="small text-secondary">{titulo}</div>
        <div className="h5 mb-0">{valor}</div>
        {detalle ? <div className="small text-secondary">{detalle}</div> : null}
      </div>
    </div>
  );
}

function TablaAgrupada({ titulo, filas, renderClave = (clave) => clave }) {
  return (
    <div className="col-12 col-lg-6">
      <h3 className="h6 small text-secondary mb-2">{titulo}</h3>
      {filas.length ? (
        <div className="table-responsive">
          <table className="table table-sm small align-middle mb-0" aria-label={titulo}>
            <thead>
              <tr>
                <th scope="col" />
                <th scope="col" className="text-end">Llamadas</th>
                <th scope="col" className="text-end">Tokens (ent./sal.)</th>
                <th scope="col" className="text-end">Costo est.</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.clave}>
                  <th scope="row" className="fw-normal">{renderClave(fila.clave)}</th>
                  <td className="text-end">{fila.llamadas}</td>
                  <td className="text-end text-nowrap">
                    {fila.segundosAudio && !fila.tokensEntrada
                      ? formatearDuracion(fila.segundosAudio)
                      : `${formatearTokens(fila.tokensEntrada)} / ${formatearTokens(fila.tokensSalida)}`}
                  </td>
                  <td className="text-end text-nowrap">{formatearUsd(fila.costoUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="small text-secondary mb-0">Sin consumo en el período.</p>
      )}
    </div>
  );
}

/**
 * Consumo de IA para el administrador: tokens de Claude, minutos de Azure Speech y costo
 * estimado con precios de lista. La factura real está en la consola de cada proveedor.
 */
export default function UsoIa({ api = apiAdmin }) {
  const [rango, setRango] = useState(rangoMesActual);
  const [uso, setUso] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setUso(await api.usoIa(rango));
    } catch (excepcion) {
      setError(excepcion.message);
    } finally {
      setCargando(false);
    }
  }, [api, rango]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiar = (campo) => (evento) => setRango((previo) => ({ ...previo, [campo]: evento.target.value }));

  return (
    <section className="card border-0 shadow-sm" aria-labelledby="titulo-uso-ia">
      <div className="card-header bg-white d-flex flex-wrap justify-content-between align-items-end gap-2">
        <div>
          <h2 id="titulo-uso-ia" className="h6 mb-0">
            <i className="bi bi-stars me-1" aria-hidden="true" />
            Uso de IA
          </h2>
          <small className="text-secondary">Tokens de Claude, audio transcrito con Azure Speech y costo estimado.</small>
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-end">
          <div>
            <label htmlFor="uso-desde" className="form-label small mb-0">Desde</label>
            <input id="uso-desde" type="date" className="form-control form-control-sm" value={rango.desde} max={rango.hasta} onChange={cambiar('desde')} />
          </div>
          <div>
            <label htmlFor="uso-hasta" className="form-label small mb-0">Hasta</label>
            <input id="uso-hasta" type="date" className="form-control form-control-sm" value={rango.hasta} min={rango.desde} onChange={cambiar('hasta')} />
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={cargar} disabled={cargando} aria-label="Actualizar consumo">
            <i className="bi bi-arrow-clockwise" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="card-body d-flex flex-column gap-3">
        {error ? <Mensaje tipo="danger">{error}</Mensaje> : null}
        {cargando && !uso ? (
          <p className="small text-secondary mb-0" role="status">
            Cargando consumo…
          </p>
        ) : null}

        {uso ? (
          <>
            <div className="row g-2">
              <Indicador titulo="Costo estimado" valor={formatearUsd(uso.total.costoUsd)} detalle={`${uso.total.llamadas} llamadas en el período`} />
              <Indicador
                titulo="Claude"
                valor={`${uso.claude.llamadas} llamadas`}
                detalle={`${formatearTokens(uso.claude.tokensEntrada)} entrada · ${formatearTokens(uso.claude.tokensSalida)} salida`}
              />
              <Indicador
                titulo="Costo medio por llamada"
                valor={formatearUsd(uso.claude.llamadas ? uso.claude.costoUsd / uso.claude.llamadas : 0)}
                detalle="Claude"
              />
              <div className="col-6 col-lg-3">
                <div className="border rounded p-2 h-100">
                  <div className="small text-secondary">Voz (Azure, este mes)</div>
                  <div className="h5 mb-1">
                    {formatearNumero(uso.voz.minutosMes)} de {formatearNumero(uso.voz.minutosGratisMes)} min
                  </div>
                  <div
                    className="progress"
                    role="progressbar"
                    aria-label="Cuota gratis de voz usada"
                    aria-valuenow={porcentajeCuota(uso.voz.minutosMes, uso.voz.minutosGratisMes)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    style={{ height: 6 }}
                  >
                    <div className="progress-bar" style={{ width: `${porcentajeCuota(uso.voz.minutosMes, uso.voz.minutosGratisMes)}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="row g-3">
              <TablaAgrupada titulo="Por ayuda de IA" filas={uso.porTarea} renderClave={nombreTarea} />
              <TablaAgrupada titulo="Por usuario" filas={uso.porUsuario} />
              <TablaAgrupada titulo="Por día" filas={uso.porDia} />
              <TablaAgrupada titulo="Por modelo" filas={uso.porModelo} />
            </div>

            <details>
              <summary className="small">Últimas llamadas ({uso.ultimas.length})</summary>
              <div className="table-responsive mt-2">
                <table className="table table-sm small mb-0" aria-label="Últimas llamadas">
                  <thead>
                    <tr>
                      <th scope="col">Fecha (UTC)</th>
                      <th scope="col">Ayuda</th>
                      <th scope="col">Usuario</th>
                      <th scope="col">Modelo</th>
                      <th scope="col" className="text-end">Consumo</th>
                      <th scope="col" className="text-end">Costo est.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uso.ultimas.map((fila) => (
                      <tr key={fila.id}>
                        <td className="text-nowrap">{fila.fecha}</td>
                        <td>
                          {nombreTarea(fila.tarea)}
                          {fila.resultado !== 'ok' ? <span className="badge text-bg-warning ms-1">{fila.resultado}</span> : null}
                        </td>
                        <td>{fila.usuario || '—'}</td>
                        <td>{fila.modelo}</td>
                        <td className="text-end text-nowrap">
                          {fila.proveedor === 'azure-speech'
                            ? formatearDuracion(fila.segundosAudio)
                            : `${formatearTokens(fila.tokensEntrada)} / ${formatearTokens(fila.tokensSalida)}`}
                        </td>
                        <td className="text-end text-nowrap">{formatearUsd(fila.costoUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>

            <p className="small text-secondary mb-0">
              Costo estimado con precios de lista (Claude Opus: USD 4 por millón de tokens de entrada y USD 20 por millón de salida).
              La factura real está en la consola de Anthropic y en Azure Cost Management. El plan gratis de Azure Speech incluye
              5 horas de audio al mes.
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}
