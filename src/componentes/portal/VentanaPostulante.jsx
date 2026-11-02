import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { formatearFecha } from '../../dominio/formateo';
import { apiDocumentos } from '../../servicios/apiDocumentos';

const SELECTOR_ENFOCABLES =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Fila "etiqueta: valor" de la ficha; se omite el valor vacío con un guion. */
function Dato({ etiqueta, children }) {
  return (
    <div className="col-12 col-sm-6">
      <dt className="small text-secondary fw-normal">{etiqueta}</dt>
      <dd className="mb-0 text-break">{children || '—'}</dd>
    </div>
  );
}

/**
 * Ventana con el detalle de un postulante del portal: sus datos de contacto, la oferta
 * a la que postuló y su CV. Desde aquí el analista también decide (pasar a evaluación,
 * descartar o reactivar); la jefatura solo consulta. Se cierra con Cerrar, Escape o un
 * clic fuera del contenido, igual que las demás ventanas de la app.
 */
export default function VentanaPostulante({
  postulacion,
  colorEstado = '',
  soloLectura = false,
  conServidor = false,
  alPasarAEvaluacion,
  alCambiarEstado,
  alCerrar,
  api = apiDocumentos,
}) {
  const { candidato, oferta } = postulacion;
  const nombre = candidato?.nombre ?? 'Postulante eliminado';
  const [descargando, setDescargando] = useState(false);
  const [errorCv, setErrorCv] = useState(null);
  const refDialogo = useRef(null);
  const refCerrarBoton = useRef(null);
  const refCerrar = useRef(alCerrar);
  refCerrar.current = alCerrar;

  useEffect(() => {
    const enfocadoAntes = document.activeElement;
    document.body.classList.add('modal-open');
    refCerrarBoton.current?.focus();

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

  const descargarCv = async () => {
    setErrorCv(null);
    setDescargando(true);
    try {
      await api.descargarCvPostulacion(postulacion);
    } catch (error) {
      setErrorCv(error.message);
    } finally {
      setDescargando(false);
    }
  };

  return createPortal(
    <>
      <div
        ref={refDialogo}
        className="modal d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventana-postulante-titulo"
        tabIndex={-1}
        onMouseDown={(evento) => {
          if (evento.target === evento.currentTarget) alCerrar();
        }}
      >
        <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <div>
                <h2 id="ventana-postulante-titulo" className="h5 mb-1">
                  {nombre}
                </h2>
                <span className={`badge ${colorEstado}`}>{postulacion.estado}</span>
                <small className="text-secondary ms-2">
                  Postuló el {formatearFecha(postulacion.fechaPostulacion)}
                </small>
              </div>
              <button ref={refCerrarBoton} type="button" className="btn-close" aria-label="Cerrar" onClick={alCerrar} />
            </div>

            <div className="modal-body d-flex flex-column gap-4">
              <section aria-labelledby="postulante-contacto">
                <h3 id="postulante-contacto" className="h6 text-uppercase small text-secondary mb-2">
                  Datos del postulante
                </h3>
                <dl className="row g-3 mb-0">
                  <Dato etiqueta="Correo">
                    {candidato?.correo ? <a href={`mailto:${candidato.correo}`}>{candidato.correo}</a> : null}
                  </Dato>
                  <Dato etiqueta="Teléfono">
                    {candidato?.telefono ? <a href={`tel:${candidato.telefono}`}>{candidato.telefono}</a> : null}
                  </Dato>
                  <Dato etiqueta="Ciudad de residencia">{postulacion.ciudad}</Dato>
                  <Dato etiqueta="Origen">
                    {candidato?.origen === 'Interno'
                      ? 'Interno (trabaja en AquaChile)'
                      : candidato?.origen === 'Externo'
                        ? 'Externo'
                        : null}
                  </Dato>
                </dl>
              </section>

              <section aria-labelledby="postulante-oferta">
                <h3 id="postulante-oferta" className="h6 text-uppercase small text-secondary mb-2">
                  Oferta a la que postuló
                </h3>
                {oferta ? (
                  <dl className="row g-3 mb-0">
                    <Dato etiqueta="Oferta">{oferta.titulo}</Dato>
                    <Dato etiqueta="Cargo">{oferta.cargo}</Dato>
                    <Dato etiqueta="Área">{oferta.area}</Dato>
                    <Dato etiqueta="Familia de cargo">{oferta.familiaCargo}</Dato>
                    <Dato etiqueta="Ubicación">
                      {[oferta.ubicacion, oferta.region].filter(Boolean).join(', ')}
                    </Dato>
                    <Dato etiqueta="Jornada">{oferta.jornada}</Dato>
                  </dl>
                ) : (
                  <p className="text-secondary mb-0">La oferta ya no existe.</p>
                )}
              </section>

              <section aria-labelledby="postulante-cv">
                <h3 id="postulante-cv" className="h6 text-uppercase small text-secondary mb-2">
                  Currículum
                </h3>
                {postulacion.cvNombre ? (
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <span className="text-break">
                      <i className="bi bi-file-earmark-person me-1" aria-hidden="true" />
                      {postulacion.cvNombre}
                    </span>
                    {conServidor ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={descargarCv}
                        disabled={descargando}
                      >
                        <i className="bi bi-download me-1" aria-hidden="true" />
                        {descargando ? 'Descargando…' : 'Descargar CV'}
                      </button>
                    ) : (
                      <small className="text-secondary">La descarga necesita el servidor.</small>
                    )}
                  </div>
                ) : (
                  <p className="text-secondary mb-0">El postulante no adjuntó CV.</p>
                )}
                {errorCv ? (
                  <p className="text-danger small mb-0 mt-2" role="alert">
                    {errorCv}
                  </p>
                ) : null}
              </section>
            </div>

            <div className="modal-footer">
              {postulacion.estado === 'En evaluación' && postulacion.solicitudId ? (
                <Link to={`/solicitudes/${postulacion.solicitudId}`} className="btn btn-link me-auto">
                  Ver solicitud #{postulacion.solicitudId}
                </Link>
              ) : null}
              <button type="button" className="btn btn-outline-primary" onClick={alCerrar}>
                Cerrar
              </button>
              {!soloLectura && postulacion.estado === 'Recibida' ? (
                <>
                  <button
                    type="button"
                    className="btn btn-outline-danger"
                    onClick={() => alCambiarEstado(postulacion, 'Descartada')}
                  >
                    Descartar
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => alPasarAEvaluacion(postulacion)}>
                    Pasar a evaluación
                  </button>
                </>
              ) : null}
              {!soloLectura && postulacion.estado === 'Descartada' ? (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => alCambiarEstado(postulacion, 'Recibida')}
                >
                  Reactivar
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>,
    document.body,
  );
}
