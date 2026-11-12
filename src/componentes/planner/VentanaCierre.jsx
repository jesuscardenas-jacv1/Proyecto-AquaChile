import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MOTIVOS_CIERRE } from '../../datos/constantes';
import { validarCierre } from '../../dominio/planner';

const SELECTOR_ENFOCABLES =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Ventana para cerrar una solicitud sin evaluación (el candidato no se presentó, desistió,
 * no cumple requisitos u otro motivo). Si no se presentó a una entrevista ya agendada,
 * ofrece reagendar en vez de cerrar. Se cierra con Cancelar, Escape o un clic fuera.
 */
export default function VentanaCierre({ solicitud, candidato, alConfirmar, alReagendar, alCerrar }) {
  const [cierre, setCierre] = useState({ motivo: '', comentario: '' });
  // Si la app creó el evento en el calendario, se ofrece cancelarlo (marcado por defecto).
  const [cancelarReunion, setCancelarReunion] = useState(true);
  const [errores, setErrores] = useState({});
  const refDialogo = useRef(null);
  const refPrimerCampo = useRef(null);
  const refCerrar = useRef(alCerrar);
  refCerrar.current = alCerrar;

  useEffect(() => {
    const enfocadoAntes = document.activeElement;
    document.body.classList.add('modal-open');
    refPrimerCampo.current?.focus();

    const alPresionarTecla = (evento) => {
      if (evento.key === 'Escape') {
        refCerrar.current();
        return;
      }
      if (evento.key !== 'Tab' || !refDialogo.current) return;
      const enfocables = [...refDialogo.current.querySelectorAll(SELECTOR_ENFOCABLES)];
      if (enfocables.length === 0) return;
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
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

  const cambiar = (campo, valor) => {
    setCierre((actual) => ({ ...actual, [campo]: valor }));
    setErrores((actual) => ({ ...actual, [campo]: undefined }));
  };

  const enviar = (evento) => {
    evento.preventDefault();
    const nuevosErrores = validarCierre(cierre);
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }
    alConfirmar({
      motivo: cierre.motivo,
      comentario: cierre.comentario.trim(),
      ...(solicitud.reunionEnCalendario ? { cancelarReunion } : {}),
    });
  };

  const noSePresento = cierre.motivo === 'No se presentó a la entrevista';

  return createPortal(
    <>
      <div
        ref={refDialogo}
        className="modal d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventana-cierre-titulo"
        tabIndex={-1}
        onMouseDown={(evento) => {
          if (evento.target === evento.currentTarget) alCerrar();
        }}
      >
        <div className="modal-dialog modal-dialog-centered">
          <form className="modal-content border-0 shadow" onSubmit={enviar} noValidate>
            <div className="modal-header">
              <div>
                <h2 id="ventana-cierre-titulo" className="h5 mb-0">
                  Cerrar sin evaluación
                </h2>
                <small className="text-secondary">
                  {candidato?.nombre ?? 'Candidato'} · {solicitud.cargo}
                </small>
              </div>
              <button type="button" className="btn-close" aria-label="Cerrar" onClick={alCerrar} />
            </div>

            <div className="modal-body d-flex flex-column gap-3">
              <fieldset>
                <legend className="form-label fs-6">Motivo *</legend>
                {MOTIVOS_CIERRE.map((motivo, indice) => (
                  <div key={motivo} className="form-check">
                    <input
                      ref={indice === 0 ? refPrimerCampo : undefined}
                      id={`cierre-motivo-${indice}`}
                      className={`form-check-input ${errores.motivo ? 'is-invalid' : ''}`.trim()}
                      type="radio"
                      name="motivo"
                      value={motivo}
                      checked={cierre.motivo === motivo}
                      onChange={() => cambiar('motivo', motivo)}
                    />
                    <label className="form-check-label" htmlFor={`cierre-motivo-${indice}`}>
                      {motivo}
                    </label>
                  </div>
                ))}
                {errores.motivo ? <div className="invalid-feedback d-block">{errores.motivo}</div> : null}
              </fieldset>

              {noSePresento && alReagendar ? (
                <div className="border rounded p-2 small d-flex flex-wrap align-items-center gap-2">
                  <i className="bi bi-calendar-week text-primary" aria-hidden="true" />
                  <span className="flex-grow-1">¿Prefieres darle otra fecha en vez de cerrar?</span>
                  <button type="button" className="btn btn-sm btn-outline-primary" onClick={alReagendar}>
                    Reagendar
                  </button>
                </div>
              ) : null}

              <div>
                <label className="form-label" htmlFor="cierre-comentario">
                  Comentario{cierre.motivo === 'Otro' ? ' *' : ' (opcional)'}
                </label>
                <textarea
                  id="cierre-comentario"
                  rows={3}
                  maxLength={500}
                  className={`form-control ${errores.comentario ? 'is-invalid' : ''}`.trim()}
                  placeholder="Ej.: no respondió los llamados; aceptó otra oferta."
                  value={cierre.comentario}
                  onChange={(evento) => cambiar('comentario', evento.target.value)}
                />
                {errores.comentario ? <div className="invalid-feedback">{errores.comentario}</div> : null}
              </div>

              {solicitud.reunionEnCalendario ? (
                <div className="form-check">
                  <input
                    id="cierre-cancelar-reunion"
                    className="form-check-input"
                    type="checkbox"
                    checked={cancelarReunion}
                    onChange={(evento) => setCancelarReunion(evento.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="cierre-cancelar-reunion">
                    Cancelar también la reunión de {solicitud.modalidadEntrevista || 'la entrevista'} en el calendario
                  </label>
                </div>
              ) : null}

              <p className="small text-secondary mb-0">
                La solicitud queda <strong>Finalizada sin evaluación</strong> y sale del flujo del Planner. Se
                puede reabrir si fue un error.
              </p>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline-primary" onClick={alCerrar}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-danger">
                <i className="bi bi-x-circle me-1" aria-hidden="true" />
                Cerrar solicitud
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>,
    document.body,
  );
}
