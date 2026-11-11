import { useEffect, useState } from 'react';
import { formatearFecha } from '../../dominio/formateo';
import { apiIa, useIaDisponible } from '../../servicios/apiIa';

function Lista({ titulo, icono, elementos, vacio, renderizar }) {
  return (
    <div>
      <h4 className="h6 small fw-semibold mb-1">
        <i className={`bi ${icono} me-1`} aria-hidden="true" />
        {titulo}
      </h4>
      {elementos.length ? (
        <ul className="small mb-0 ps-3">
          {elementos.map((elemento, indice) => (
            <li key={indice}>{renderizar(elemento)}</li>
          ))}
        </ul>
      ) : (
        <p className="small text-secondary mb-0">{vacio}</p>
      )}
    </div>
  );
}

/**
 * Análisis del CV hecho con IA: compara el CV con el descriptor del cargo y propone
 * preguntas para la entrevista. Es una sugerencia: no puntúa ni recomienda descartar.
 * Solo aparece si el servidor tiene la IA configurada. La jefatura ve el último análisis.
 */
export default function PanelAnalisisCv({ postulacion, puedeAnalizar = false, api = apiIa }) {
  const disponible = useIaDisponible(api);
  const [analisis, setAnalisis] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!disponible) return undefined;
    let vigente = true;
    setCargando(true);
    api
      .obtenerAnalisis(postulacion.id)
      .then((guardado) => vigente && setAnalisis(guardado))
      .catch((excepcion) => vigente && setError(excepcion.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [api, disponible, postulacion.id]);

  if (!disponible) return null;

  const analizar = async () => {
    setError(null);
    setAnalizando(true);
    try {
      setAnalisis(await api.analizarPostulacion(postulacion.id));
    } catch (excepcion) {
      setError(excepcion.message);
    } finally {
      setAnalizando(false);
    }
  };

  const resultado = analisis?.resultado;

  return (
    <section aria-labelledby="postulante-ia" className="border rounded p-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <h3 id="postulante-ia" className="h6 text-uppercase small text-secondary mb-0">
          <i className="bi bi-stars me-1" aria-hidden="true" />
          Análisis del CV con IA
        </h3>
        {puedeAnalizar ? (
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={analizar} disabled={analizando || cargando}>
            {analizando ? (
              <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
            ) : (
              <i className="bi bi-stars me-1" aria-hidden="true" />
            )}
            {analizando ? 'Analizando…' : resultado ? 'Volver a analizar' : 'Analizar CV'}
          </button>
        ) : null}
      </div>

      {analizando ? (
        <p className="small text-secondary mb-2" role="status">
          Leyendo el CV y el descriptor del cargo. Puede tardar hasta un minuto.
        </p>
      ) : null}
      {error ? (
        <p className="small text-danger mb-2" role="alert">
          {error}
        </p>
      ) : null}

      {resultado ? (
        <div className="d-flex flex-column gap-3">
          <p className="small mb-0">{resultado.resumen}</p>
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <Lista
                titulo="Coincidencias con el cargo"
                icono="bi-check2-circle text-success"
                elementos={resultado.coincidencias}
                vacio="No se encontraron coincidencias claras."
                renderizar={(item) => (
                  <>
                    <strong>{item.requisito}:</strong> {item.evidencia}
                  </>
                )}
              />
            </div>
            <div className="col-12 col-md-6">
              <Lista
                titulo="Brechas a revisar"
                icono="bi-exclamation-circle text-warning"
                elementos={resultado.brechas}
                vacio="No se detectaron brechas."
                renderizar={(item) => (
                  <>
                    <strong>{item.requisito}:</strong> {item.detalle}
                  </>
                )}
              />
            </div>
          </div>
          <Lista
            titulo="Preguntas sugeridas para la entrevista"
            icono="bi-chat-left-text"
            elementos={resultado.preguntasSugeridas}
            vacio="Sin preguntas sugeridas."
            renderizar={(pregunta) => pregunta}
          />
          {resultado.alertas.length ? (
            <Lista
              titulo="Datos a confirmar"
              icono="bi-info-circle"
              elementos={resultado.alertas}
              vacio=""
              renderizar={(alerta) => alerta}
            />
          ) : null}
          <p className="small text-secondary mb-0">
            Sugerencia generada por IA el {formatearFecha(analisis.creadoEn?.slice(0, 10))}
            {analisis.descriptor ? `, comparando con ${analisis.descriptor}` : ', sin descriptor del cargo'}. No reemplaza
            el criterio del equipo ni debe usarse por sí sola para descartar a nadie.
          </p>
        </div>
      ) : !cargando && !analizando && !error ? (
        <p className="small text-secondary mb-0">
          {puedeAnalizar
            ? 'Compara el CV con el descriptor del cargo y propone preguntas para la entrevista.'
            : 'Esta postulación aún no tiene análisis.'}
        </p>
      ) : null}
    </section>
  );
}
