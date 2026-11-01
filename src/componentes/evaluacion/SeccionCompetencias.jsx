import { COMPETENCIAS, NIVELES_COMPETENCIA } from '../../datos/constantes';
import { normalizar } from '../../dominio/texto';

const idDe = (competencia) => `competencia-${normalizar(competencia).replace(/\s+/g, '-')}`;

/**
 * Evaluación por competencias (opcional): la psicóloga marca las competencias que evaluó y,
 * por cada una, indica el nivel, las fortalezas y las oportunidades de desarrollo, como en
 * el formato de informe del equipo. Recibe y devuelve la lista completa de competencias.
 */
export default function SeccionCompetencias({ competencias = [], alCambiar, errores = {} }) {
  const buscar = (competencia) => competencias.find((item) => item.competencia === competencia);

  const alternar = (competencia) => {
    alCambiar(
      buscar(competencia)
        ? competencias.filter((item) => item.competencia !== competencia)
        : [...competencias, { competencia, nivel: '', fortalezas: '', oportunidades: '' }],
    );
  };

  const cambiar = (competencia, campo, valor) => {
    alCambiar(competencias.map((item) => (item.competencia === competencia ? { ...item, [campo]: valor } : item)));
  };

  return (
    <fieldset>
      <legend className="form-label fs-6 mb-1">Evaluación por competencias</legend>
      <p className="form-text mt-0 mb-2">
        Opcional. Las competencias aparecen en el informe que recibe el analista; las observaciones clínicas no.
      </p>

      <div className="d-flex flex-column gap-2">
        {COMPETENCIAS.map((competencia) => {
          const item = buscar(competencia);
          const id = idDe(competencia);
          const error = errores[`competencia:${competencia}`];
          return (
            <div key={competencia} className={`border rounded p-2 ${item ? 'bg-white' : ''}`.trim()}>
              <div className="form-check">
                <input
                  id={id}
                  type="checkbox"
                  className="form-check-input"
                  checked={Boolean(item)}
                  onChange={() => alternar(competencia)}
                />
                <label className="form-check-label fw-semibold" htmlFor={id}>
                  {competencia}
                </label>
              </div>

              {item ? (
                <div className="row g-2 mt-1">
                  <div className="col-12 col-md-4">
                    <label className="form-label small" htmlFor={`${id}-nivel`}>
                      Nivel *
                    </label>
                    <select
                      id={`${id}-nivel`}
                      className={`form-select form-select-sm ${error && !item.nivel ? 'is-invalid' : ''}`.trim()}
                      value={item.nivel}
                      onChange={(evento) => cambiar(competencia, 'nivel', evento.target.value)}
                    >
                      <option value="">Seleccione</option>
                      {NIVELES_COMPETENCIA.map((nivel) => (
                        <option key={nivel}>{nivel}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 col-md-8">
                    <label className="form-label small" htmlFor={`${id}-fortalezas`}>
                      Fortalezas
                    </label>
                    <textarea
                      id={`${id}-fortalezas`}
                      rows={2}
                      maxLength={600}
                      className="form-control form-control-sm"
                      value={item.fortalezas}
                      onChange={(evento) => cambiar(competencia, 'fortalezas', evento.target.value)}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label small" htmlFor={`${id}-oportunidades`}>
                      Oportunidades de desarrollo
                    </label>
                    <textarea
                      id={`${id}-oportunidades`}
                      rows={2}
                      maxLength={600}
                      className="form-control form-control-sm"
                      value={item.oportunidades}
                      onChange={(evento) => cambiar(competencia, 'oportunidades', evento.target.value)}
                    />
                  </div>
                  {error ? <div className="col-12 text-danger small">{error}</div> : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
