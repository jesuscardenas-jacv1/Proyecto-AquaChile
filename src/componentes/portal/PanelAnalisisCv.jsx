import { useEffect, useState } from 'react';
import { agruparRequisitos, nivelRequisito, textoFuente, tramoCumplimiento } from '../../dominio/analisisCv';
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

/** Un grupo de requisitos (cumple, brechas o por confirmar) con el detalle de cada uno. */
function GrupoRequisitos({ titulo, icono, criterios, vacio = null, mostrarNivel = false }) {
  if (!criterios.length && !vacio) return null;
  return (
    <div className="mt-3">
      <h4 className="h6 small fw-semibold mb-1">
        <i className={`bi ${icono} me-1`} aria-hidden="true" />
        {titulo}
      </h4>
      {criterios.length ? (
        <ul className="list-unstyled small mb-0">
          {criterios.map((criterio, indice) => {
            const nivel = nivelRequisito(criterio.nivel);
            return (
              <li key={`${criterio.requisito}-${indice}`} className="d-flex gap-2 py-1 border-top">
                <i className={`bi ${nivel.icono} ${nivel.clase}`} aria-hidden="true" />
                <div>
                  <strong>{criterio.requisito}</strong>
                  {criterio.tipo === 'deseable' ? <span className="badge text-bg-light border ms-1">Deseable</span> : null}
                  {mostrarNivel ? <span className="ms-1 text-secondary">· {nivel.etiqueta}</span> : null}
                  {criterio.evidencia ? <div className="text-secondary">{criterio.evidencia}</div> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="small text-secondary mb-0">{vacio}</p>
      )}
    </div>
  );
}

/**
 * Porcentaje de cumplimiento de los requisitos y el detalle por requisito. La IA clasifica cada
 * requisito; el número lo calcula el servidor con reglas fijas que se explican aquí mismo.
 */
function Cumplimiento({ criterios, cumplimiento }) {
  const tramo = tramoCumplimiento(cumplimiento?.porcentaje);
  const grupos = agruparRequisitos(criterios);
  return (
    <div>
      {tramo ? (
        <div className="mb-2">
          <div className="d-flex flex-wrap align-items-baseline gap-2">
            <span className="h4 mb-0 fw-semibold">{cumplimiento.porcentaje} %</span>
            <span className="small">de cumplimiento de {textoFuente(cumplimiento.fuente)} según el CV</span>
          </div>
          <div
            className="progress my-1"
            role="progressbar"
            aria-label="Cumplimiento de requisitos según el CV"
            aria-valuenow={cumplimiento.porcentaje}
            aria-valuemin={0}
            aria-valuemax={100}
            style={{ height: '0.5rem' }}
          >
            <div className={`progress-bar ${tramo.color}`} style={{ width: `${cumplimiento.porcentaje}%` }} />
          </div>
          <p className="small text-secondary mb-0">
            {tramo.texto}. Obligatorios cumplidos: {cumplimiento.obligatoriosCumplidos} de {cumplimiento.obligatoriosTotal}.
          </p>
        </div>
      ) : (
        <p className="small text-secondary mb-2">
          Sin porcentaje: no hay requisitos que se puedan comprobar con el CV.
        </p>
      )}

      <GrupoRequisitos
        titulo="Requisitos que respalda el CV"
        icono="bi-check2-circle text-success"
        criterios={grupos.cumple}
      />
      <GrupoRequisitos
        titulo="Brechas para el cargo"
        icono="bi-exclamation-triangle text-warning"
        criterios={grupos.brechas}
        vacio="No se detectaron brechas con los requisitos del cargo."
        mostrarNivel
      />
      <GrupoRequisitos
        titulo="Confirmar en la entrevista"
        icono="bi-question-circle text-info"
        criterios={grupos.porConfirmar}
      />

      <details className="small text-secondary mt-2">
        <summary>¿Cómo se calcula?</summary>
        Cada requisito obligatorio pesa 2 y cada deseable 1. Cumple suma el peso completo, parcial la mitad y sin
        evidencia nada. Los que solo se pueden confirmar en la entrevista (por ejemplo, disponibilidad para turnos) no
        entran en el cálculo.
      </details>
    </div>
  );
}

/**
 * Análisis del CV hecho con IA: compara el CV con los requisitos del cargo (porcentaje de
 * cumplimiento calculado por el servidor) y propone preguntas para la entrevista.
 * Es un apoyo para preparar la entrevista: no recomienda contratar ni descartar.
 * Solo aparece si el servidor tiene la IA configurada. La jefatura ve el último análisis.
 */
export default function PanelAnalisisCv({ postulacion, solicitudId = null, puedeAnalizar = false, api = apiIa }) {
  // Desde una solicitud (psicóloga) se muestra el análisis de la postulación de origen, solo lectura.
  const desdeSolicitud = solicitudId !== null;
  const disponible = useIaDisponible(api);
  const [analisis, setAnalisis] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [analizando, setAnalizando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!disponible) return undefined;
    let vigente = true;
    setCargando(true);
    (desdeSolicitud ? api.obtenerAnalisisSolicitud(solicitudId) : api.obtenerAnalisis(postulacion.id))
      .then((guardado) => vigente && setAnalisis(guardado))
      .catch((excepcion) => vigente && setError(excepcion.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [api, disponible, desdeSolicitud, solicitudId, postulacion?.id]);

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
        {puedeAnalizar && !desdeSolicitud ? (
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
          Comparando el CV con los requisitos del cargo. Puede tardar hasta un minuto.
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
          {resultado.criterios ? (
            <Cumplimiento criterios={resultado.criterios} cumplimiento={resultado.cumplimiento} />
          ) : (
            // Análisis guardados antes de los criterios por requisito.
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <Lista
                  titulo="Coincidencias con el cargo"
                  icono="bi-check2-circle text-success"
                  elementos={resultado.coincidencias ?? []}
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
                  elementos={resultado.brechas ?? []}
                  vacio="No se detectaron brechas."
                  renderizar={(item) => (
                    <>
                      <strong>{item.requisito}:</strong> {item.detalle}
                    </>
                  )}
                />
              </div>
            </div>
          )}
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
            ? 'Compara el CV con los requisitos del cargo, calcula el porcentaje de cumplimiento y propone preguntas para la entrevista.'
            : desdeSolicitud
              ? 'Este candidato no tiene análisis de CV (la solicitud no viene del portal o no se analizó su CV en Postulaciones).'
              : 'Esta postulación aún no tiene análisis.'}
        </p>
      ) : null}
    </section>
  );
}
