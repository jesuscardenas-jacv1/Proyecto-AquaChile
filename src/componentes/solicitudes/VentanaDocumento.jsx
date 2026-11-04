import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { visorDeArchivo } from '../../dominio/documentos';

const SELECTOR_ENFOCABLES =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Convierte un Word (.docx) en HTML; la librería se carga solo cuando hace falta. */
async function wordAHtml(contenido) {
  const { default: mammoth } = await import('mammoth/mammoth.browser');
  const { value } = await mammoth.convertToHtml({ arrayBuffer: await contenido.arrayBuffer() });
  return `<!doctype html><meta charset="utf-8"><style>body{font:15px/1.5 system-ui,sans-serif;color:#16252f;background:#fff;max-width:760px;margin:0 auto;padding:24px}img,table{max-width:100%}</style>${value}`;
}

/**
 * Muestra un documento de la carpeta sin salir del portal: PDF, imagen, audio, video o
 * Word (.docx). Los demás formatos no se pueden mostrar en el navegador y se ofrece
 * descargarlos. Se cierra con Cerrar, Escape o un clic fuera del contenido.
 */
export default function VentanaDocumento({ solicitudId, archivo, api, alCerrar }) {
  const visor = visorDeArchivo(archivo.nombre);
  const [estado, setEstado] = useState(visor ? { cargando: true } : {});
  const [errorDescarga, setErrorDescarga] = useState(null);
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

  useEffect(() => {
    if (!visor) return undefined;
    let vigente = true;
    let url = null;
    (async () => {
      try {
        const contenido = await api.contenido(solicitudId, archivo);
        if (visor.visor === 'word') {
          const html = await wordAHtml(contenido);
          if (vigente) setEstado({ html });
          return;
        }
        // El tipo sale de la extensión permitida, no de lo que declare el archivo.
        url = URL.createObjectURL(new Blob([contenido], { type: visor.tipo }));
        if (vigente) setEstado({ url });
        else URL.revokeObjectURL(url);
      } catch (error) {
        if (vigente) setEstado({ error: error.message });
      }
    })();
    return () => {
      vigente = false;
      if (url) URL.revokeObjectURL(url);
    };
    // Se carga una vez por archivo; `visor` se deriva de su nombre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, solicitudId, archivo]);

  const descargar = async () => {
    setErrorDescarga(null);
    try {
      await api.descargar(solicitudId, archivo);
    } catch (error) {
      setErrorDescarga(error.message);
    }
  };

  return createPortal(
    <>
      <div
        ref={refDialogo}
        className="modal d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventana-documento-titulo"
        tabIndex={-1}
        onMouseDown={(evento) => {
          if (evento.target === evento.currentTarget) alCerrar();
        }}
      >
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content border-0 shadow">
            <div className="modal-header gap-2">
              <h2 id="ventana-documento-titulo" className="h6 mb-0 text-break flex-grow-1">
                {archivo.nombre}
              </h2>
              <button type="button" className="btn btn-sm btn-outline-primary flex-shrink-0" onClick={descargar}>
                <i className="bi bi-download me-1" aria-hidden="true" />
                Descargar
              </button>
              <button ref={refCerrarBoton} type="button" className="btn-close ms-1" aria-label="Cerrar" onClick={alCerrar} />
            </div>
            <div className="modal-body visor-documento p-0">
              {errorDescarga ? (
                <p className="text-danger small m-3" role="alert">
                  {errorDescarga}
                </p>
              ) : null}
              {estado.cargando ? (
                <p className="text-secondary text-center py-5 mb-0" role="status">
                  <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                  Abriendo documento…
                </p>
              ) : null}
              {estado.error ? (
                <p className="text-danger text-center py-5 px-3 mb-0" role="alert">
                  {estado.error}
                </p>
              ) : null}
              {!visor ? (
                <div className="text-center py-5 px-3">
                  <i className="bi bi-file-earmark fs-1 text-secondary" aria-hidden="true" />
                  <p className="mt-2 mb-0">Este formato no se puede mostrar en el navegador. Descárgalo para abrirlo.</p>
                </div>
              ) : null}
              {estado.url && visor.visor === 'pdf' ? (
                <iframe className="visor-documento-marco" src={estado.url} title={archivo.nombre} />
              ) : null}
              {estado.url && visor.visor === 'imagen' ? (
                <img className="visor-documento-imagen" src={estado.url} alt={archivo.nombre} />
              ) : null}
              {estado.url && visor.visor === 'video' ? (
                <video className="visor-documento-imagen" src={estado.url} controls aria-label={archivo.nombre} />
              ) : null}
              {estado.url && visor.visor === 'audio' ? (
                <div className="p-4">
                  <audio className="w-100" src={estado.url} controls aria-label={archivo.nombre} />
                </div>
              ) : null}
              {estado.html ? (
                // Los CV llegan del portal público: sin scripts ni acceso a la página (sandbox).
                <iframe className="visor-documento-marco" srcDoc={estado.html} sandbox="" title={archivo.nombre} />
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
