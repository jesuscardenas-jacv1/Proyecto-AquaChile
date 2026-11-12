import { useCallback, useEffect, useState } from 'react';
import { apiAdmin } from '../../servicios/api';
import { hayCambios, nombreModelo, validarIndicaciones } from '../../dominio/configIa';
import Mensaje from '../comunes/Mensaje';

const NOMBRE_ESFUERZO = { low: 'Bajo', medium: 'Medio', high: 'Alto' };

function BloqueFijo({ titulo, children }) {
  return (
    <div>
      <h4 className="h6 small fw-semibold mb-1">{titulo}</h4>
      <div className="small bg-body-tertiary border rounded p-2" style={{ whiteSpace: 'pre-wrap' }}>
        {children}
      </div>
    </div>
  );
}

const formularioDe = (vigente) => ({ indicaciones: vigente.indicaciones, modelo: vigente.modelo, esfuerzo: vigente.esfuerzo });

/** Detalle de una ayuda de IA: lo fijo en solo lectura y lo editable en un formulario. */
function DetalleTarea({ tarea, configuracion, api, alGuardar }) {
  const [formulario, setFormulario] = useState(() => formularioDe(tarea.vigente));
  const [guardando, setGuardando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    setFormulario(formularioDe(tarea.vigente));
    setConfirmando(false);
  }, [tarea]);

  const error = validarIndicaciones(formulario.indicaciones, configuracion.largoMaximo);
  const cambiado = hayCambios(formulario, tarea.vigente);
  const cambiar = (campo) => (evento) => setFormulario((previo) => ({ ...previo, [campo]: evento.target.value }));

  const ejecutar = async (accion, exito) => {
    setGuardando(true);
    setMensaje(null);
    try {
      await accion();
      setMensaje({ tipo: 'success', texto: exito });
      await alGuardar();
    } catch (excepcion) {
      setMensaje({ tipo: 'danger', texto: excepcion.message });
    } finally {
      setGuardando(false);
      setConfirmando(false);
    }
  };

  const guardar = (evento) => {
    evento.preventDefault();
    if (error || !cambiado) return;
    ejecutar(
      () => api.guardarConfigIa(tarea.id, { ...formulario, indicaciones: formulario.indicaciones.trim() }),
      'Configuración guardada. Se aplica desde la próxima llamada.',
    );
  };

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h3 className="h6 mb-0">{tarea.nombre}</h3>
          <small className="text-secondary">{tarea.usadoPor}</small>
        </div>
        <span className={`badge ${tarea.vigente.personalizada ? 'text-bg-warning' : 'text-bg-light border'}`}>
          {tarea.vigente.personalizada ? `Personalizada por ${tarea.vigente.actualizadoPor || 'el admin'}` : 'Valores originales'}
        </span>
      </div>

      {mensaje ? (
        <Mensaje tipo={mensaje.tipo} alCerrar={() => setMensaje(null)}>
          {mensaje.texto}
        </Mensaje>
      ) : null}

      <div className="row g-3">
        <div className="col-12 col-xl-6 d-flex flex-column gap-2">
          <p className="small text-secondary mb-0">
            <i className="bi bi-lock me-1" aria-hidden="true" />
            Fijo: protege a los postulantes y la pantalla depende del formato de salida.
          </p>
          <BloqueFijo titulo="Rol de la IA">{tarea.sistema}</BloqueFijo>
          <BloqueFijo titulo="Reglas comunes">{configuracion.reglasComunes}</BloqueFijo>
          <BloqueFijo titulo="Datos que recibe">{tarea.entrada}</BloqueFijo>
          {tarea.limites ? <BloqueFijo titulo="Límites de la tarea">{tarea.limites}</BloqueFijo> : null}
          <BloqueFijo titulo="Campos que debe devolver">
            <ul className="mb-0 ps-3">
              {tarea.campos.map((campo) => (
                <li key={campo}>{campo}</li>
              ))}
            </ul>
          </BloqueFijo>
        </div>

        <form className="col-12 col-xl-6 d-flex flex-column gap-2" onSubmit={guardar} noValidate>
          <p className="small text-secondary mb-0">
            <i className="bi bi-pencil me-1" aria-hidden="true" />
            Editable: qué entregar y cómo, con qué modelo y cuánto razonar.
          </p>
          <div>
            <label htmlFor={`indicaciones-${tarea.id}`} className="form-label small fw-semibold mb-1">
              Indicaciones
            </label>
            <textarea
              id={`indicaciones-${tarea.id}`}
              className={`form-control form-control-sm font-monospace ${error ? 'is-invalid' : ''}`}
              rows={10}
              value={formulario.indicaciones}
              onChange={cambiar('indicaciones')}
              maxLength={configuracion.largoMaximo}
            />
            <div className="d-flex justify-content-between">
              <div className="invalid-feedback d-block">{error}</div>
              <small className="text-secondary text-nowrap">
                {formulario.indicaciones.length} / {configuracion.largoMaximo}
              </small>
            </div>
          </div>
          <div className="row g-2">
            <div className="col-12 col-sm-7">
              <label htmlFor={`modelo-${tarea.id}`} className="form-label small fw-semibold mb-1">
                Modelo
              </label>
              <select id={`modelo-${tarea.id}`} className="form-select form-select-sm" value={formulario.modelo} onChange={cambiar('modelo')}>
                <option value="">{nombreModelo('', configuracion.modelos, configuracion.modeloServidor)}</option>
                {configuracion.modelos.map((modelo) => (
                  <option key={modelo.id} value={modelo.id}>
                    {modelo.nombre}
                  </option>
                ))}
              </select>
              <small className="text-secondary">
                {configuracion.modelos.find((modelo) => modelo.id === formulario.modelo)?.detalle ?? 'El modelo configurado en el servidor.'}
              </small>
            </div>
            <div className="col-12 col-sm-5">
              <label htmlFor={`esfuerzo-${tarea.id}`} className="form-label small fw-semibold mb-1">
                Esfuerzo
              </label>
              <select id={`esfuerzo-${tarea.id}`} className="form-select form-select-sm" value={formulario.esfuerzo} onChange={cambiar('esfuerzo')}>
                {configuracion.esfuerzos.map((esfuerzo) => (
                  <option key={esfuerzo.id} value={esfuerzo.id}>
                    {esfuerzo.nombre}
                    {esfuerzo.id === tarea.original.esfuerzo ? ' (original)' : ''}
                  </option>
                ))}
              </select>
              <small className="text-secondary">
                {configuracion.esfuerzos.find((esfuerzo) => esfuerzo.id === formulario.esfuerzo)?.detalle}
              </small>
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2">
            <button type="submit" className="btn btn-sm btn-primary" disabled={guardando || !cambiado || Boolean(error)}>
              <i className="bi bi-save me-1" aria-hidden="true" />
              Guardar cambios
            </button>
            {cambiado ? (
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setFormulario(formularioDe(tarea.vigente))}>
                Descartar
              </button>
            ) : null}
            {tarea.vigente.personalizada && !confirmando ? (
              <button type="button" className="btn btn-sm btn-outline-danger ms-auto" onClick={() => setConfirmando(true)}>
                <i className="bi bi-arrow-counterclockwise me-1" aria-hidden="true" />
                Restablecer original
              </button>
            ) : null}
          </div>
          {confirmando ? (
            <Mensaje tipo="warning" titulo="¿Volver a los valores originales?">
              Se usarán las indicaciones, el modelo y el esfuerzo originales. El cambio queda en el historial.
              <div className="d-flex gap-2 mt-2">
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  disabled={guardando}
                  onClick={() => ejecutar(() => api.restablecerConfigIa(tarea.id), 'Se restablecieron los valores originales.')}
                >
                  Sí, restablecer
                </button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setConfirmando(false)}>
                  Cancelar
                </button>
              </div>
            </Mensaje>
          ) : null}
        </form>
      </div>

      <details>
        <summary className="small">Historial de cambios ({tarea.historial.length})</summary>
        {tarea.historial.length ? (
          <ul className="small mt-2 mb-0 ps-3">
            {tarea.historial.map((cambio) => (
              <li key={cambio.id}>
                {cambio.fecha} (UTC) · {cambio.usuario || '—'} · {cambio.accion === 'restablecer' ? 'restableció los originales' : 'editó'} ·{' '}
                {nombreModelo(cambio.modelo, configuracion.modelos, configuracion.modeloServidor)} · esfuerzo{' '}
                {NOMBRE_ESFUERZO[cambio.esfuerzo] ?? cambio.esfuerzo}
              </li>
            ))}
          </ul>
        ) : (
          <p className="small text-secondary mt-2 mb-0">Sin cambios: se usan los valores originales.</p>
        )}
      </details>
    </div>
  );
}

/**
 * Configuración de las ayudas de IA para el administrador: muestra el contexto completo que
 * recibe la IA y permite ajustar las indicaciones, el modelo y el esfuerzo de cada ayuda.
 */
export default function ConfiguracionIa({ api = apiAdmin }) {
  const [configuracion, setConfiguracion] = useState(null);
  const [seleccionada, setSeleccionada] = useState('analizarCv');
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setConfiguracion(await api.configIa());
      setError(null);
    } catch (excepcion) {
      setError(excepcion.message);
    }
  }, [api]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const tarea = configuracion?.tareas.find((t) => t.id === seleccionada) ?? configuracion?.tareas[0];

  return (
    <section className="card border-0 shadow-sm" aria-labelledby="titulo-config-ia">
      <div className="card-header bg-white">
        <h2 id="titulo-config-ia" className="h6 mb-0">
          <i className="bi bi-sliders me-1" aria-hidden="true" />
          Configuración de IA
        </h2>
        <small className="text-secondary">
          Qué recibe la IA en cada ayuda. Las reglas de protección y el formato de salida son fijos.
        </small>
      </div>
      <div className="card-body d-flex flex-column gap-3">
        {error ? <Mensaje tipo="danger">{error}</Mensaje> : null}
        {!configuracion && !error ? (
          <p className="small text-secondary mb-0" role="status">
            Cargando configuración…
          </p>
        ) : null}
        {configuracion ? (
          <>
            <ul className="nav nav-pills small flex-wrap gap-1" role="tablist" aria-label="Ayudas de IA">
              {configuracion.tareas.map((t) => (
                <li key={t.id} className="nav-item" role="presentation">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={t.id === tarea.id}
                    className={`nav-link py-1 px-2 ${t.id === tarea.id ? 'active' : ''}`}
                    onClick={() => setSeleccionada(t.id)}
                  >
                    {t.nombre}
                    {t.vigente.personalizada ? <i className="bi bi-pencil-fill ms-1" aria-label="personalizada" /> : null}
                  </button>
                </li>
              ))}
            </ul>
            <DetalleTarea key={tarea.id} tarea={tarea} configuracion={configuracion} api={api} alGuardar={cargar} />
          </>
        ) : null}
      </div>
    </section>
  );
}
