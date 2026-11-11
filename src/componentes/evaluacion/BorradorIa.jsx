import { useState } from 'react';

const LARGO_MINIMO = 30;

/**
 * Borrador de la evaluación con IA: la psicóloga pega sus notas de la entrevista y recibe una
 * propuesta de competencias y observaciones, que se carga en el formulario para que la edite.
 * El resultado solo se sugiere (con su fundamento): ella lo marca. Las notas no se guardan.
 */
export default function BorradorIa({ alGenerar, alAplicar, hayContenido = false }) {
  const [notas, setNotas] = useState('');
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(null);
  const [sugerencia, setSugerencia] = useState(null);

  const generar = async () => {
    if (notas.trim().length < LARGO_MINIMO) {
      setError('Escribe tus notas de la entrevista (al menos unas líneas) para generar el borrador.');
      return;
    }
    if (hayContenido && !window.confirm('El borrador reemplazará las observaciones y competencias que ya escribiste. ¿Continuar?')) {
      return;
    }
    setError(null);
    setGenerando(true);
    try {
      const borrador = await alGenerar(notas.trim());
      alAplicar(borrador);
      setSugerencia(borrador);
    } catch (excepcion) {
      setError(excepcion.message);
    } finally {
      setGenerando(false);
    }
  };

  return (
    <section aria-labelledby="borrador-ia-titulo" className="border rounded p-3 mb-3">
      <h3 id="borrador-ia-titulo" className="h6 mb-1">
        <i className="bi bi-stars me-1" aria-hidden="true" />
        Borrador con IA desde tus notas
      </h3>
      <p className="form-text mt-0 mb-2">
        Pega tus notas de la entrevista. La IA propone competencias y observaciones para que las revises. Las notas no
        se guardan.
      </p>
      <label className="form-label small" htmlFor="notas-entrevista">
        Notas de la entrevista
      </label>
      <textarea
        id="notas-entrevista"
        className="form-control"
        rows={5}
        value={notas}
        onChange={(evento) => {
          setNotas(evento.target.value);
          setError(null);
        }}
        placeholder="Ej: Relata que coordina el turno con su equipo; ante una falla de equipo informó a la jefatura y propuso…"
      />
      <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={generar} disabled={generando}>
          {generando ? (
            <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
          ) : (
            <i className="bi bi-stars me-1" aria-hidden="true" />
          )}
          {generando ? 'Generando borrador…' : 'Generar borrador'}
        </button>
        {generando ? (
          <small className="text-secondary" role="status">
            Puede tardar hasta un minuto.
          </small>
        ) : null}
      </div>
      {error ? (
        <p className="small text-danger mb-0 mt-2" role="alert">
          {error}
        </p>
      ) : null}

      {sugerencia ? (
        <div className="mt-3 small d-flex flex-column gap-2" role="status">
          <p className="mb-0 text-success">
            <i className="bi bi-check2-circle me-1" aria-hidden="true" />
            Se cargaron {sugerencia.competencias.length} competencias y las observaciones. Revisa y ajusta cada una antes
            de guardar.
          </p>
          <p className="mb-0">
            <strong>Resultado sugerido:</strong> {sugerencia.resultadoSugerido}. {sugerencia.fundamento}{' '}
            <span className="text-secondary">El resultado lo eliges tú abajo.</span>
          </p>
          {sugerencia.competencias.length ? (
            <div>
              <strong>Evidencia usada</strong>
              <ul className="mb-0 ps-3">
                {sugerencia.competencias.map((item) => (
                  <li key={item.competencia}>
                    {item.competencia}: {item.evidencia}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {sugerencia.faltantes.length ? (
            <div>
              <strong>Falta evidencia o conviene indagar</strong>
              <ul className="mb-0 ps-3">
                {sugerencia.faltantes.map((faltante) => (
                  <li key={faltante}>{faltante}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
