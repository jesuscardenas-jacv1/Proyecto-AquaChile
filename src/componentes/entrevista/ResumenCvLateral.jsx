import { agruparCriterios } from '../../dominio/entrevista';
import { nivelRequisito, tramoCumplimiento } from '../../dominio/analisisCv';

/** Anillo de progreso con el porcentaje de cumplimiento. */
function Anillo({ porcentaje }) {
  const radio = 26;
  const perimetro = 2 * Math.PI * radio;
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden="true" className="flex-shrink-0">
      <circle cx="34" cy="34" r={radio} fill="none" stroke="var(--bs-border-color)" strokeWidth="7" />
      <circle
        cx="34"
        cy="34"
        r={radio}
        fill="none"
        stroke="var(--bs-primary)"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${(perimetro * porcentaje) / 100} ${perimetro}`}
        transform="rotate(-90 34 34)"
      />
      <text x="34" y="39" textAnchor="middle" fontSize="15" fontWeight="600" fill="currentColor">
        {porcentaje}%
      </text>
    </svg>
  );
}

function Seccion({ titulo, icono, cantidad, abierta = false, children }) {
  return (
    <details className="panel-entrevista-acordeon" open={abierta}>
      <summary>
        <i className={`bi ${icono} me-2`} aria-hidden="true" />
        <span className="me-auto">{titulo}</span>
        {cantidad !== undefined ? <span className="badge text-bg-light border me-2">{cantidad}</span> : null}
        <i className="bi bi-chevron-down panel-entrevista-flecha" aria-hidden="true" />
      </summary>
      <div className="pt-2">{children}</div>
    </details>
  );
}

function ListaCriterios({ criterios, vacio }) {
  if (!criterios.length) return <p className="small text-secondary mb-0">{vacio}</p>;
  return (
    <ul className="list-unstyled small mb-0 d-flex flex-column gap-2">
      {criterios.map((criterio, indice) => {
        const nivel = nivelRequisito(criterio.nivel);
        return (
          <li key={indice} className="d-flex gap-2">
            <i className={`bi ${nivel.icono} ${nivel.clase} mt-1`} aria-hidden="true" />
            <div>
              <span className="fw-semibold">{criterio.requisito}</span>
              {criterio.nivel !== 'cumple' ? <span className="text-secondary"> · {nivel.etiqueta}</span> : null}
              {criterio.evidencia ? <div className="text-secondary fst-italic">“{criterio.evidencia}”</div> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Panel lateral del panel de entrevista: el análisis del CV que hizo el analista con IA
 * (cumplimiento, resumen, fortalezas, brechas) y las preguntas sugeridas como lista para
 * marcar durante la entrevista. Es una sugerencia: la psicóloga decide qué preguntar.
 */
export default function ResumenCvLateral({
  analisis,
  tienePostulacion = false,
  observaciones = '',
  preguntasHechas = [],
  alMarcarPregunta = () => {},
  alPlegar,
}) {
  const resultado = analisis?.resultado;
  const { fortalezas, brechas, porConfirmar } = agruparCriterios(resultado?.criterios);
  const cumplimiento = resultado?.cumplimiento;
  const tramo = tramoCumplimiento(cumplimiento?.porcentaje);
  const preguntas = resultado?.preguntasSugeridas ?? [];

  return (
    <aside className="card border-0 shadow-sm h-100" aria-labelledby="resumen-cv-titulo">
      <div className="card-header bg-white d-flex align-items-center gap-2 py-3">
        <i className="bi bi-person-vcard text-primary" aria-hidden="true" />
        <h2 id="resumen-cv-titulo" className="h6 mb-0 me-auto">
          Resumen del CV
        </h2>
        {resultado ? <span className="badge bg-info-subtle text-info-emphasis">Sugerencia de IA – revisar</span> : null}
        {alPlegar ? (
          <button type="button" className="btn btn-sm btn-link text-secondary p-0" onClick={alPlegar} title="Plegar panel">
            <i className="bi bi-chevron-double-right" aria-hidden="true" />
            <span className="visually-hidden">Plegar el resumen del CV</span>
          </button>
        ) : null}
      </div>

      <div className="card-body d-flex flex-column gap-3 overflow-auto">
        {!resultado ? (
          <p className="small text-secondary mb-0">
            {tienePostulacion
              ? 'El analista aún no analizó el CV de esta postulación con IA. Puedes revisarlo en la carpeta de la solicitud.'
              : 'Esta solicitud no viene del portal "Trabaja con nosotros": no hay análisis del CV con IA.'}
          </p>
        ) : (
          <>
            <div className="panel-entrevista-cumplimiento rounded p-3 d-flex align-items-center gap-3">
              {tramo ? <Anillo porcentaje={cumplimiento.porcentaje} /> : null}
              <div className="small">
                {tramo ? (
                  <>
                    <div className="fw-semibold">{cumplimiento.porcentaje} % de cumplimiento</div>
                    <div className="text-secondary">
                      {cumplimiento.obligatoriosCumplidos} de {cumplimiento.obligatoriosTotal} obligatorios
                    </div>
                  </>
                ) : (
                  <div className="text-secondary">Sin porcentaje: no hay requisitos comprobables con el CV.</div>
                )}
                {analisis.oferta ? <div className="text-secondary">Oferta: {analisis.oferta}</div> : null}
              </div>
            </div>

            <div className="d-flex flex-column gap-2">
              <Seccion titulo="Resumen" icono="bi-file-text">
                <p className="small mb-0">{resultado.resumen}</p>
                {observaciones ? (
                  <p className="small mb-0 mt-2">
                    <span className="fw-semibold">Pedido del reclutador:</span> {observaciones}
                  </p>
                ) : null}
              </Seccion>
              <Seccion titulo="Fortalezas" icono="bi-patch-check" cantidad={fortalezas.length}>
                <ListaCriterios criterios={fortalezas} vacio="El CV no muestra requisitos cumplidos con claridad." />
              </Seccion>
              <Seccion titulo="Brechas" icono="bi-exclamation-circle" cantidad={brechas.length + porConfirmar.length}>
                <ListaCriterios criterios={[...brechas, ...porConfirmar]} vacio="Sin brechas en los requisitos." />
                {resultado.alertas?.length ? (
                  <ul className="small text-warning-emphasis mt-2 mb-0 ps-3">
                    {resultado.alertas.map((alerta) => (
                      <li key={alerta}>{alerta}</li>
                    ))}
                  </ul>
                ) : null}
              </Seccion>
              <Seccion
                titulo="Preguntas sugeridas"
                icono="bi-question-circle"
                cantidad={`${preguntasHechas.filter((pregunta) => preguntas.includes(pregunta)).length}/${preguntas.length}`}
                abierta
              >
                {preguntas.length ? (
                  <ul className="list-unstyled small mb-0 d-flex flex-column gap-2">
                    {preguntas.map((pregunta, indice) => {
                      const hecha = preguntasHechas.includes(pregunta);
                      return (
                        <li key={pregunta} className="form-check">
                          <input
                            id={`pregunta-${indice}`}
                            type="checkbox"
                            className="form-check-input"
                            checked={hecha}
                            onChange={() => alMarcarPregunta(pregunta)}
                          />
                          <label
                            htmlFor={`pregunta-${indice}`}
                            className={`form-check-label ${hecha ? 'text-decoration-line-through text-secondary' : ''}`}
                          >
                            {pregunta}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="small text-secondary mb-0">El análisis no trae preguntas sugeridas.</p>
                )}
              </Seccion>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
