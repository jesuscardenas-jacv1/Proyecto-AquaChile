import { useEffect, useRef, useState } from 'react';
import { apiIa } from '../../servicios/apiIa';
import { iniciarGrabacion, puedeGrabar } from '../../servicios/grabadora';

const EXTENSIONES = '.vtt,.docx,.txt';
const LARGO_MINIMO_TEXTO = 30;

/** "05:07" o "1:02:05" a partir de segundos. */
export function formatearDuracion(segundos) {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  const dos = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}`;
}

/** Mensaje de avance según el tiempo de espera: primero transcribe, luego ordena las notas. */
function mensajeProgreso({ conAudio, segundos, conIa }) {
  if (conAudio && segundos < 20) return 'Transcribiendo el audio con Azure AI Speech…';
  return conIa ? 'Ordenando las notas por competencia con IA…' : 'Guardando la transcripción…';
}

/**
 * Entrevista con IA (solo la psicóloga): con el consentimiento del postulante, graba la
 * entrevista (presencial o por Meet / Teams web) o recibe la transcripción exportada,
 * la guarda como pauta confidencial y propone notas por competencia para el borrador.
 */
export default function EntrevistaIa({
  solicitudId,
  vozDisponible = false,
  iaDisponible = false,
  puedeUsarEnBorrador = false,
  alUsarNotas,
  alGuardarPauta = () => {},
  api = apiIa,
  grabar = iniciarGrabacion,
  grabacionPosible = puedeGrabar,
}) {
  const [consentimiento, setConsentimiento] = useState(false);
  const [modo, setModo] = useState(null); // 'microfono' | 'reunion' | 'archivo'
  const [grabando, setGrabando] = useState(null); // { modo, control }
  const [segundos, setSegundos] = useState(0);
  const [procesando, setProcesando] = useState(null); // { conAudio, inicio }
  const [espera, setEspera] = useState(0);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [cargandoPauta, setCargandoPauta] = useState(false);
  const grabacionRef = useRef(null);

  // Cronómetro de la grabación y del procesamiento.
  useEffect(() => {
    if (!grabando && !procesando) return undefined;
    const intervalo = setInterval(() => {
      if (grabando) setSegundos((valor) => valor + 1);
      else setEspera((valor) => valor + 1);
    }, 1000);
    return () => clearInterval(intervalo);
  }, [grabando, procesando]);

  // Si se sale de la página con una grabación en curso, se descarta.
  useEffect(() => () => grabacionRef.current?.control.cancelar(), []);

  const procesar = async (conAudio, tarea) => {
    setError(null);
    setEspera(0);
    setProcesando({ conAudio });
    try {
      const respuesta = await tarea();
      setResultado(respuesta);
      setModo(null);
      setTexto('');
      alGuardarPauta(respuesta.archivo);
    } catch (excepcion) {
      setError(excepcion.message);
    } finally {
      setProcesando(null);
    }
  };

  const detener = async () => {
    const actual = grabacionRef.current;
    if (!actual) return;
    grabacionRef.current = null;
    setGrabando(null);
    const audio = await actual.control.detener();
    if (!audio.size) {
      setError('La grabación quedó vacía. Revisa el micrófono e intenta de nuevo.');
      return;
    }
    await procesar(true, () => api.transcribirAudio(solicitudId, audio, actual.modo));
  };

  const comenzar = async (modoGrabacion) => {
    setError(null);
    setResultado(null);
    try {
      const control = await grabar({ modo: modoGrabacion, alTerminar: () => detener() });
      grabacionRef.current = { control, modo: modoGrabacion };
      setSegundos(0);
      setGrabando({ modo: modoGrabacion });
    } catch (excepcion) {
      setError(excepcion.message);
    }
  };

  const cancelar = async () => {
    const actual = grabacionRef.current;
    grabacionRef.current = null;
    setGrabando(null);
    await actual?.control.cancelar();
  };

  const subirArchivo = (evento) => {
    const [archivo] = evento.target.files ?? [];
    evento.target.value = '';
    if (archivo) procesar(false, () => api.subirTranscripcion(solicitudId, archivo));
  };

  const enviarTexto = () => {
    if (texto.trim().length < LARGO_MINIMO_TEXTO) {
      setError('Pega la transcripción completa (al menos unas líneas).');
      return;
    }
    procesar(false, () => api.subirTranscripcion(solicitudId, texto.trim()));
  };

  /** Carga la última transcripción guardada (con sus notas) para pasarla al borrador. */
  const usarUltimaGuardada = async () => {
    setError(null);
    setCargandoPauta(true);
    try {
      setResultado({ ...(await api.ultimaTranscripcion(solicitudId)), desdePauta: true });
    } catch (excepcion) {
      setError(excepcion.message);
    } finally {
      setCargandoPauta(false);
    }
  };

  const ocupado = Boolean(grabando || procesando || cargandoPauta);
  const opciones = [
    vozDisponible && grabacionPosible('microfono')
      ? { id: 'microfono', icono: 'bi-mic', titulo: 'Grabar entrevista presencial' }
      : null,
    vozDisponible && grabacionPosible('reunion')
      ? { id: 'reunion', icono: 'bi-camera-video', titulo: 'Grabar reunión en línea (Meet o Teams web)' }
      : null,
    { id: 'archivo', icono: 'bi-file-earmark-text', titulo: 'Subir transcripción exportada' },
  ].filter(Boolean);

  return (
    <section aria-labelledby="entrevista-ia-titulo" className="border rounded p-3 mb-3">
      <h3 id="entrevista-ia-titulo" className="h6 mb-1">
        <i className="bi bi-soundwave me-1" aria-hidden="true" />
        Entrevista con IA
      </h3>
      <p className="form-text mt-0 mb-2">
        Transcribe la entrevista y propone notas por competencia para el borrador. La transcripción se guarda como pauta
        de entrevista (confidencial: solo la ves tú).{' '}
        {vozDisponible ? 'El audio se envía a Azure AI Speech para transcribirlo y no se guarda.' : null}
      </p>

      {puedeUsarEnBorrador && iaDisponible && !resultado ? (
        <div className="border rounded p-2 mb-3 small">
          <p className="mb-2">¿Ya transcribiste esta entrevista? Usa la última transcripción guardada y sus notas.</p>
          <button type="button" className="btn btn-sm btn-primary" onClick={usarUltimaGuardada} disabled={ocupado}>
            {cargandoPauta ? (
              <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
            ) : (
              <i className="bi bi-clock-history me-1" aria-hidden="true" />
            )}
            Usar la última transcripción guardada
          </button>
        </div>
      ) : null}

      <div className="alert alert-warning small py-2 mb-2">
        <i className="bi bi-shield-lock me-1" aria-hidden="true" />
        Antes de grabar, informa al postulante para qué se graba, que el audio no se guarda y que la transcripción queda
        en su carpeta confidencial (Ley 21.719). Sin su aceptación, toma notas a mano.
      </div>
      <div className="form-check mb-3">
        <input
          id="consentimiento-grabacion"
          className="form-check-input"
          type="checkbox"
          checked={consentimiento}
          disabled={ocupado}
          onChange={(evento) => setConsentimiento(evento.target.checked)}
        />
        <label className="form-check-label" htmlFor="consentimiento-grabacion">
          El postulante aceptó que se grabe la entrevista
        </label>
      </div>

      {grabando ? (
        <div className="d-flex flex-wrap align-items-center gap-2" role="status">
          <span className="badge text-bg-danger">
            <i className="bi bi-record-circle me-1" aria-hidden="true" />
            Grabando {formatearDuracion(segundos)}
          </span>
          <button type="button" className="btn btn-sm btn-primary" onClick={detener}>
            <i className="bi bi-stop-fill me-1" aria-hidden="true" />
            Detener y transcribir
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={cancelar}>
            Descartar
          </button>
        </div>
      ) : (
        <div className="d-flex flex-wrap gap-2" role="group" aria-label="Cómo obtener la transcripción">
          {opciones.map((opcion) => (
            <button
              key={opcion.id}
              type="button"
              className={`btn btn-sm ${modo === opcion.id ? 'btn-primary' : 'btn-outline-primary'}`}
              disabled={!consentimiento || ocupado}
              aria-pressed={modo === opcion.id}
              onClick={() => {
                setError(null);
                setModo(opcion.id);
              }}
            >
              <i className={`bi ${opcion.icono} me-1`} aria-hidden="true" />
              {opcion.titulo}
            </button>
          ))}
        </div>
      )}
      {!consentimiento && !grabando ? (
        <p className="small text-secondary mb-0 mt-2">Marca el consentimiento para habilitar las opciones.</p>
      ) : null}

      {consentimiento && !ocupado && modo === 'microfono' ? (
        <div className="small mt-3">
          <p className="mb-2">
            Deja el equipo cerca de ambos y graba toda la conversación. Al terminar, detén la grabación.
          </p>
          <button type="button" className="btn btn-sm btn-danger" onClick={() => comenzar('microfono')}>
            <i className="bi bi-record-circle me-1" aria-hidden="true" />
            Comenzar a grabar
          </button>
        </div>
      ) : null}

      {consentimiento && !ocupado && modo === 'reunion' ? (
        <div className="small mt-3">
          <ol className="ps-3 mb-2">
            <li>Abre la reunión de Meet o de Teams en otra pestaña de Chrome o Edge (no en la app de escritorio).</li>
            <li>Pulsa «Comenzar a grabar» y permite el micrófono.</li>
            <li>
              En la ventana para compartir, elige la pestaña <strong>Pestaña de Chrome</strong> de la reunión y activa{' '}
              <strong>«Compartir audio de la pestaña»</strong>.
            </li>
            <li>Vuelve a esta pestaña y, al terminar, pulsa «Detener y transcribir».</li>
          </ol>
          <button type="button" className="btn btn-sm btn-danger" onClick={() => comenzar('reunion')}>
            <i className="bi bi-record-circle me-1" aria-hidden="true" />
            Comenzar a grabar
          </button>
        </div>
      ) : null}

      {consentimiento && !ocupado && modo === 'archivo' ? (
        <div className="small mt-3 d-flex flex-column gap-2">
          <p className="mb-0">
            En Teams: <em>Grabaciones y transcripciones → Transcripción → Descargar (.vtt o .docx)</em>. En Meet: la
            transcripción llega como documento de Google; descárgala como .docx o .txt.
          </p>
          <div>
            <label className="form-label small mb-1" htmlFor="archivo-transcripcion">
              Archivo de transcripción (.vtt, .docx o .txt)
            </label>
            <input
              id="archivo-transcripcion"
              type="file"
              className="form-control form-control-sm"
              accept={EXTENSIONES}
              onChange={subirArchivo}
            />
          </div>
          <div>
            <label className="form-label small mb-1" htmlFor="texto-transcripcion">
              O pega el texto de la transcripción
            </label>
            <textarea
              id="texto-transcripcion"
              className="form-control form-control-sm"
              rows={4}
              value={texto}
              onChange={(evento) => {
                setTexto(evento.target.value);
                setError(null);
              }}
            />
            <button type="button" className="btn btn-sm btn-outline-primary mt-2" onClick={enviarTexto}>
              Procesar texto
            </button>
          </div>
        </div>
      ) : null}

      {procesando ? (
        <p className="small text-secondary mb-0 mt-3" role="status">
          <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
          {mensajeProgreso({ conAudio: procesando.conAudio, segundos: espera, conIa: iaDisponible })} (
          {formatearDuracion(espera)})
        </p>
      ) : null}

      {error ? (
        <p className="small text-danger mb-0 mt-2" role="alert">
          {error}
        </p>
      ) : null}

      {resultado ? (
        <ResultadoEntrevista
          resultado={resultado}
          conBorrador={iaDisponible}
          puedeUsarEnBorrador={puedeUsarEnBorrador}
          alUsarNotas={() => alUsarNotas(resultado.notas?.notas || resultado.transcripcion)}
        />
      ) : null}
    </section>
  );
}

function ResultadoEntrevista({ resultado, conBorrador, puedeUsarEnBorrador, alUsarNotas }) {
  const { notas, errorNotas, transcripcion, archivo, hablantes, desdePauta } = resultado;
  return (
    <div className="mt-3 small d-flex flex-column gap-2">
      <p className="mb-0 text-success" role="status">
        <i className="bi bi-check2-circle me-1" aria-hidden="true" />
        {desdePauta ? 'Transcripción cargada desde la pauta' : 'Transcripción guardada como pauta'}
        {archivo?.nombre ? `: ${archivo.nombre}` : ''}.{hablantes ? ` Se distinguieron ${hablantes} voces.` : ''}
      </p>
      {desdePauta && !notas ? (
        <p className="mb-0 text-secondary">Esa pauta no trae notas: se usará la transcripción en el borrador.</p>
      ) : null}
      {errorNotas ? <p className="mb-0 text-warning-emphasis">No se pudieron generar las notas: {errorNotas}</p> : null}

      {notas ? (
        <div>
          <strong>Notas por competencia (revísalas)</strong>
          {notas.competencias.length ? (
            <ul className="mb-1 ps-3">
              {notas.competencias.map((item) => (
                <li key={item.competencia}>
                  <strong>{item.competencia}:</strong> {item.observacion}
                  {item.citas.length ? (
                    <ul className="ps-3 text-secondary">
                      {item.citas.map((cita) => (
                        <li key={cita}>«{cita}»</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : desdePauta ? (
            <pre className="small mb-1" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
              {notas.notas}
            </pre>
          ) : (
            <p className="mb-1">La IA no encontró evidencia clara de las competencias del catálogo.</p>
          )}
          {notas.temasPendientes.length ? (
            <>
              <strong>Temas pendientes</strong>
              <ul className="mb-0 ps-3">
                {notas.temasPendientes.map((tema) => (
                  <li key={tema}>{tema}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      <details>
        <summary>Ver transcripción</summary>
        <pre
          className="small bg-light border rounded p-2 mt-2 mb-0"
          style={{ whiteSpace: 'pre-wrap', maxHeight: '20rem' }}
        >
          {transcripcion}
        </pre>
      </details>

      {conBorrador ? (
        <div>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={alUsarNotas}
            disabled={!puedeUsarEnBorrador}
          >
            <i className="bi bi-box-arrow-in-down me-1" aria-hidden="true" />
            Usar en el borrador
          </button>
          {!puedeUsarEnBorrador ? (
            <span className="d-block text-secondary mt-1">
              Para usarlas en el borrador, marca la entrevista como realizada en el Planner. La pauta ya quedó guardada
              en la carpeta.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
