import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MODALIDADES_ENTREVISTA } from '../../datos/constantes';
import { hoyIso, validarAgenda } from '../../dominio/planner';
import { SelectorFecha, SelectorHora } from './SelectorRueda';

const SELECTOR_ENFOCABLES =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Ventana emergente para agendar o reagendar la entrevista psicolaboral de una solicitud.
 * Valida fecha, hora y modalidad antes de guardar. Se cierra con Cancelar, Escape o
 * un clic fuera del contenido, igual que la ventana de detalle del dashboard.
 */
export default function VentanaAgenda({ solicitud, candidato, reagendar = false, alGuardar, alCerrar }) {
  const [agenda, setAgenda] = useState({
    fechaEntrevista: solicitud.fechaEntrevista || '',
    horaEntrevista: solicitud.horaEntrevista || '',
    modalidadEntrevista: solicitud.modalidadEntrevista || 'Teams',
  });
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

  const cambiar = (campo) => (valor) => {
    setAgenda((actual) => ({ ...actual, [campo]: valor }));
    setErrores((actual) => ({ ...actual, [campo]: undefined }));
  };

  const enviar = (evento) => {
    evento.preventDefault();
    const nuevosErrores = validarAgenda(agenda, solicitud);
    if (Object.keys(nuevosErrores).length > 0) {
      setErrores(nuevosErrores);
      return;
    }
    alGuardar(agenda);
  };

  const titulo = reagendar ? 'Reagendar entrevista' : 'Agendar entrevista';
  const claseCampo = (campo, base) => `${base} ${errores[campo] ? 'is-invalid' : ''}`.trim();

  return createPortal(
    <>
      <div
        ref={refDialogo}
        className="modal d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventana-agenda-titulo"
        tabIndex={-1}
        onMouseDown={(evento) => {
          if (evento.target === evento.currentTarget) alCerrar();
        }}
      >
        <div className="modal-dialog modal-dialog-centered">
          <form className="modal-content border-0 shadow" onSubmit={enviar} noValidate>
            <div className="modal-header">
              <div>
                <h2 id="ventana-agenda-titulo" className="h5 mb-0">
                  {titulo}
                </h2>
                <small className="text-secondary">
                  {candidato?.nombre ?? 'Candidato'} · {solicitud.cargo}
                </small>
              </div>
              <button type="button" className="btn-close" aria-label="Cerrar" onClick={alCerrar} />
            </div>

            <div className="modal-body">
              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <SelectorFecha
                    valor={agenda.fechaEntrevista}
                    onChange={cambiar('fechaEntrevista')}
                    refInicial={refPrimerCampo}
                  />
                  <div className={errores.fechaEntrevista ? 'text-danger small mt-1' : 'visually-hidden'}>
                    {errores.fechaEntrevista}
                  </div>
                </div>

                <div className="col-12 col-md-6">
                  <SelectorHora valor={agenda.horaEntrevista} onChange={cambiar('horaEntrevista')} />
                  <div className={errores.horaEntrevista ? 'text-danger small mt-1' : 'visually-hidden'}>
                    {errores.horaEntrevista}
                  </div>
                </div>

                <div className="col-12">
                  <label className="form-label" htmlFor="agenda-modalidad">
                    Modalidad
                  </label>
                  <select
                    id="agenda-modalidad"
                    className={claseCampo('modalidadEntrevista', 'form-select')}
                    value={agenda.modalidadEntrevista}
                    onChange={(evento) => cambiar('modalidadEntrevista')(evento.target.value)}
                    aria-describedby="agenda-modalidad-error"
                  >
                    {MODALIDADES_ENTREVISTA.map((modalidad) => (
                      <option key={modalidad} value={modalidad}>
                        {modalidad}
                      </option>
                    ))}
                  </select>
                  <div id="agenda-modalidad-error" className="invalid-feedback">
                    {errores.modalidadEntrevista}
                  </div>
                </div>
              </div>

              {agenda.fechaEntrevista && agenda.fechaEntrevista < hoyIso() && !errores.fechaEntrevista ? (
                <p className="form-text text-acento mb-0 mt-3">
                  <i className="bi bi-exclamation-circle me-1" aria-hidden="true" />
                  La fecha elegida ya pasó. Úsala solo para registrar una entrevista ya coordinada.
                </p>
              ) : null}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline-primary" onClick={alCerrar}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary">
                <i className="bi bi-calendar-check me-1" aria-hidden="true" />
                {reagendar ? 'Guardar cambios' : 'Agendar'}
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
