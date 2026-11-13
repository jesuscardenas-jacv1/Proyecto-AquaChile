import { useEffect, useRef, useState } from 'react';
import { hablantesDetectados, marcaTiempo, nombreHablante } from '../../dominio/entrevista';

const ROLES = ['Psicóloga', 'Postulante'];

/** Barras que suben con el volumen: muestra que el micrófono capta voz. */
function Medidor({ nivel = 0 }) {
  const barras = [0.15, 0.35, 0.55, 0.75, 0.95];
  return (
    <span className="panel-entrevista-medidor" aria-hidden="true">
      {barras.map((umbral) => (
        <span key={umbral} className={nivel >= umbral ? 'activa' : ''} />
      ))}
    </span>
  );
}

/**
 * Transcripción en vivo del panel de entrevista: controles de grabación, aviso de
 * consentimiento, nombres de los hablantes y la conversación con marcas de tiempo.
 * Cada frase se puede citar en las notas. El estado lo maneja la página.
 */
export default function TranscripcionEnVivo({
  disponible = false,
  estado = 'inactivo', // 'inactivo' | 'iniciando' | 'grabando' | 'pausado'
  modo = 'microfono',
  modosPosibles = { microfono: true, reunion: true },
  alCambiarModo = () => {},
  consentimiento = false,
  alCambiarConsentimiento = () => {},
  segmentos = [],
  parcial = null,
  hablantes = {},
  alAsignarHablante = () => {},
  alCitar = () => {},
  alComenzar = () => {},
  alPausar = () => {},
  alReanudar = () => {},
  nivel = 0,
  error = null,
}) {
  const lista = useRef(null);
  const [alFinal, setAlFinal] = useState(true);
  const activa = estado === 'grabando' || estado === 'iniciando';
  const detectados = hablantesDetectados(segmentos);

  // Sigue la conversación mientras la psicóloga no haya subido a leer algo anterior.
  useEffect(() => {
    if (alFinal && lista.current) lista.current.scrollTop = lista.current.scrollHeight;
  }, [segmentos.length, parcial, alFinal]);

  const alDesplazar = () => {
    const elemento = lista.current;
    if (!elemento) return;
    setAlFinal(elemento.scrollHeight - elemento.scrollTop - elemento.clientHeight < 40);
  };

  return (
    <section className="card border-0 shadow-sm panel-entrevista-transcripcion" aria-labelledby="transcripcion-titulo">
      <div className="card-header bg-white d-flex flex-wrap align-items-center gap-2 py-2">
        <i className="bi bi-soundwave text-primary" aria-hidden="true" />
        <h2 id="transcripcion-titulo" className="h6 mb-0 me-auto">
          Transcripción en vivo
        </h2>
        {disponible ? (
          <>
            <label className="visually-hidden" htmlFor="fuente-audio">
              Fuente de audio
            </label>
            <select
              id="fuente-audio"
              className="form-select form-select-sm w-auto"
              value={modo}
              disabled={estado !== 'inactivo' && estado !== 'pausado'}
              onChange={(evento) => alCambiarModo(evento.target.value)}
            >
              <option value="microfono" disabled={!modosPosibles.microfono}>
                Micrófono (presencial)
              </option>
              <option value="reunion" disabled={!modosPosibles.reunion}>
                Micrófono + pestaña de la reunión
              </option>
            </select>
            {activa ? <Medidor nivel={nivel} /> : null}
            {estado === 'inactivo' ? (
              <button type="button" className="btn btn-sm btn-danger" onClick={alComenzar} disabled={!consentimiento}>
                <i className="bi bi-record-circle me-1" aria-hidden="true" />
                Comenzar a grabar
              </button>
            ) : null}
            {estado === 'iniciando' ? (
              <button type="button" className="btn btn-sm btn-outline-secondary" disabled>
                <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
                Conectando…
              </button>
            ) : null}
            {estado === 'grabando' ? (
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={alPausar}>
                <i className="bi bi-pause-fill me-1" aria-hidden="true" />
                Pausar
              </button>
            ) : null}
            {estado === 'pausado' ? (
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={alReanudar}>
                <i className="bi bi-play-fill me-1" aria-hidden="true" />
                Reanudar
              </button>
            ) : null}
          </>
        ) : null}
      </div>

      {disponible && estado === 'inactivo' && !segmentos.length ? (
        <div className="alert alert-warning small rounded-0 border-0 border-bottom mb-0 py-2">
          <i className="bi bi-shield-lock me-1" aria-hidden="true" />
          Informa al postulante antes de grabar: el audio se envía a Azure AI Speech solo para transcribirlo y{' '}
          <strong>no se guarda</strong>; la transcripción queda en su carpeta confidencial (Ley 21.719).
          <div className="form-check mt-1 mb-0">
            <input
              id="consentimiento-vivo"
              className="form-check-input"
              type="checkbox"
              checked={consentimiento}
              onChange={(evento) => alCambiarConsentimiento(evento.target.checked)}
            />
            <label className="form-check-label" htmlFor="consentimiento-vivo">
              El postulante aceptó que se grabe la entrevista
            </label>
          </div>
        </div>
      ) : null}

      {detectados.length ? (
        <div className="d-flex flex-wrap align-items-center gap-2 px-3 py-2 border-bottom small" aria-label="Quién es quién">
          <span className="text-secondary">Quién es quién:</span>
          {detectados.map((id) => (
            <label key={id} className="d-flex align-items-center gap-1">
              <span>{nombreHablante(id, {})}</span>
              <select
                className="form-select form-select-sm w-auto"
                value={hablantes[id] ?? ''}
                onChange={(evento) => alAsignarHablante(id, evento.target.value)}
                aria-label={`Rol de ${nombreHablante(id, {})}`}
              >
                <option value="">Sin asignar</option>
                {ROLES.map((rol) => (
                  <option key={rol} value={rol}>
                    {rol}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : null}

      <div className="position-relative">
        <ol
          ref={lista}
          className="list-unstyled mb-0 px-3 py-2 panel-entrevista-dialogo"
          onScroll={alDesplazar}
          aria-live="polite"
          aria-label="Conversación transcrita"
        >
          {!disponible && !segmentos.length ? (
            <li className="text-secondary small py-3">
              La transcripción en vivo no está configurada en el servidor. Toma tus notas a mano en «Mis notas».
            </li>
          ) : null}
          {disponible && !segmentos.length && !parcial ? (
            <li className="text-secondary small py-3">
              {estado === 'inactivo'
                ? 'Al comenzar a grabar, aquí aparecerá la conversación separada por hablante.'
                : 'Escuchando… la primera frase aparece apenas alguien termina de hablar.'}
            </li>
          ) : null}
          {segmentos.map((segmento, indice) => {
            const rol = hablantes[segmento.hablante];
            return (
              <li
                key={`${segmento.inicioMs}-${indice}`}
                className={`panel-entrevista-turno ${rol === 'Postulante' ? 'postulante' : ''}`}
              >
                <span className="font-monospace small text-secondary">[{marcaTiempo(segmento.inicioMs)}]</span>
                <div className="flex-grow-1">
                  <span className={`small fw-semibold ${rol === 'Postulante' ? 'text-primary' : ''}`}>
                    {nombreHablante(segmento.hablante, hablantes)}
                  </span>
                  <p className="mb-0">{segmento.texto}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-link text-decoration-none panel-entrevista-citar"
                  onClick={() => alCitar(segmento)}
                  title="Citar esta frase en mis notas"
                >
                  <i className="bi bi-quote" aria-hidden="true" />
                  <span className="visually-hidden">Citar en mis notas: </span>
                  <span className="d-none d-xl-inline ms-1">Citar</span>
                </button>
              </li>
            );
          })}
          {parcial ? (
            <li className="panel-entrevista-turno text-secondary fst-italic">
              <span className="font-monospace small">[··:··]</span>
              <div>
                <span className="small fw-semibold">{nombreHablante(parcial.hablante, hablantes)}</span>
                <p className="mb-0">{parcial.texto} …</p>
              </div>
            </li>
          ) : null}
        </ol>
        {!alFinal && segmentos.length ? (
          <button
            type="button"
            className="btn btn-sm btn-primary position-absolute bottom-0 end-0 m-2"
            onClick={() => setAlFinal(true)}
          >
            <i className="bi bi-arrow-down me-1" aria-hidden="true" />
            Ir al final
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="small text-danger mb-0 px-3 py-2 border-top" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
