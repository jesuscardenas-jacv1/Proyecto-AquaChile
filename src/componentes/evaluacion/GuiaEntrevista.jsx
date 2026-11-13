import { useEffect, useState } from 'react';
import { guiaEntrevista } from '../../dominio/analisisCv';
import { apiIa, useIaDisponible } from '../../servicios/apiIa';

function Bloque({ titulo, icono, children }) {
  return (
    <div>
      <h4 className="h6 small fw-semibold mb-1">
        <i className={`bi ${icono} me-1`} aria-hidden="true" />
        {titulo}
      </h4>
      {children}
    </div>
  );
}

/**
 * Guía para la entrevista (solo psicóloga, con la entrevista agendada o realizada): reúne del
 * análisis del CV las brechas, lo que hay que confirmar, las preguntas sugeridas y los datos a
 * confirmar, junto a las herramientas de la entrevista. Es de solo lectura: el análisis lo hace
 * el analista en Postulaciones. Si la solicitud no tiene análisis, no se muestra.
 */
export default function GuiaEntrevista({ solicitudId, api = apiIa }) {
  const disponible = useIaDisponible(api);
  const [analisis, setAnalisis] = useState(null);

  useEffect(() => {
    if (!disponible) return undefined;
    let vigente = true;
    api
      .obtenerAnalisisSolicitud(solicitudId)
      .then((guardado) => vigente && setAnalisis(guardado))
      .catch(() => vigente && setAnalisis(null));
    return () => {
      vigente = false;
    };
  }, [api, disponible, solicitudId]);

  const guia = guiaEntrevista(analisis?.resultado);
  if (!guia) return null;

  return (
    <details open className="border rounded p-3 mb-3">
      <summary className="fw-semibold small text-uppercase text-secondary">
        <i className="bi bi-list-check me-1" aria-hidden="true" />
        Guía para la entrevista
        {guia.porcentaje !== null ? (
          <span className="ms-2 text-body fw-normal" style={{ textTransform: 'none' }}>
            · {guia.porcentaje} % de cumplimiento según el CV
          </span>
        ) : null}
      </summary>

      <div className="d-flex flex-column gap-3 mt-2">
        {guia.brechas.length ? (
          <Bloque titulo="Brechas a indagar" icono="bi-exclamation-triangle text-warning">
            <ul className="small mb-0 ps-3">
              {guia.brechas.map((brecha, indice) => (
                <li key={`${brecha.requisito}-${indice}`}>
                  <strong>{brecha.requisito}</strong>
                  {brecha.tipo === 'deseable' ? ' (deseable)' : ''}
                  {brecha.detalle ? `: ${brecha.detalle}` : ''}
                </li>
              ))}
            </ul>
          </Bloque>
        ) : null}

        {guia.porConfirmar.length ? (
          <Bloque titulo="Confirmar en la entrevista" icono="bi-question-circle text-info">
            <ul className="small mb-0 ps-3">
              {guia.porConfirmar.map((requisito) => (
                <li key={requisito}>{requisito}</li>
              ))}
            </ul>
          </Bloque>
        ) : null}

        {guia.preguntas.length ? (
          <Bloque titulo="Preguntas sugeridas" icono="bi-chat-left-text">
            <ol className="small mb-0 ps-3">
              {guia.preguntas.map((pregunta) => (
                <li key={pregunta}>{pregunta}</li>
              ))}
            </ol>
          </Bloque>
        ) : null}

        {guia.alertas.length ? (
          <Bloque titulo="Datos del CV a confirmar" icono="bi-info-circle">
            <ul className="small mb-0 ps-3">
              {guia.alertas.map((alerta) => (
                <li key={alerta}>{alerta}</li>
              ))}
            </ul>
          </Bloque>
        ) : null}

        <p className="small text-secondary mb-0">
          Viene del análisis del CV con IA que hizo el analista. Es un apoyo: las conclusiones son de la entrevista.
        </p>
      </div>
    </details>
  );
}
