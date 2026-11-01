import { Fragment, useState } from 'react';
import { RESULTADOS_EVALUACION } from '../../datos/constantes';
import { hayErrores, validarEvaluacion } from '../../dominio/validaciones';
import Mensaje from '../comunes/Mensaje';
import SeccionCompetencias from './SeccionCompetencias';

const CAMPOS_INICIALES = {
  fechaEvaluacion: new Date().toISOString().slice(0, 10),
  resultado: '',
  observaciones: '',
  estado: 'Realizada',
  competencias: [],
};

/** Color de cada opción, igual al de las etiquetas de resultado del resto de la app. */
const COLOR_RESULTADO = {
  Recomendado: 'btn-outline-success',
  'Recomendado con observaciones': 'btn-outline-warning',
  'No recomendado': 'btn-outline-danger',
};

const construirEstadoInicial = (evaluacion) => ({
  ...CAMPOS_INICIALES,
  ...(evaluacion ?? {}),
  competencias: evaluacion?.competencias ?? [],
});

/**
 * Formulario para registrar o actualizar la evaluación psicolaboral.
 */
export default function FormularioEvaluacion({ evaluacion = null, alGuardar }) {
  const [formulario, setFormulario] = useState(() => construirEstadoInicial(evaluacion));
  const [errores, setErrores] = useState({});
  const [intentoEnvio, setIntentoEnvio] = useState(false);

  const cambiarCampo = (evento) => {
    const { name, value } = evento.target;
    setFormulario((actual) => ({ ...actual, [name]: value }));
    setErrores((actual) => ({ ...actual, [name]: undefined }));
  };

  const cambiarCompetencias = (competencias) => {
    setFormulario((actual) => ({ ...actual, competencias }));
    setErrores((actual) =>
      Object.fromEntries(Object.entries(actual).filter(([campo]) => !campo.startsWith('competencia:'))),
    );
  };

  const manejarEnvio = (evento) => {
    evento.preventDefault();
    setIntentoEnvio(true);
    const nuevosErrores = validarEvaluacion(formulario);
    setErrores(nuevosErrores);

    if (hayErrores(nuevosErrores)) return;
    alGuardar(formulario);
  };

  const errorDe = (campo) => (intentoEnvio ? errores[campo] : undefined);

  return (
    <form className="card border-0 shadow-sm" onSubmit={manejarEnvio} noValidate>
      <div className="card-header bg-white">
        <h2 className="h6 mb-0">
          {evaluacion ? 'Actualizar evaluación' : 'Registrar evaluación'}
        </h2>
      </div>
      <div className="card-body">
        {intentoEnvio && hayErrores(errores) ? (
          <Mensaje tipo="danger" titulo="Revisa los datos de la evaluación">
            Hay campos obligatorios o con formato inválido.
          </Mensaje>
        ) : null}

        <div className="row g-3">
          <div className="col-12 col-md-4">
            <label className="form-label" htmlFor="fechaEvaluacion">
              Fecha de evaluación *
            </label>
            <input
              id="fechaEvaluacion"
              name="fechaEvaluacion"
              type="date"
              className={`form-control ${errorDe('fechaEvaluacion') ? 'is-invalid' : ''}`.trim()}
              value={formulario.fechaEvaluacion}
              onChange={cambiarCampo}
            />
            {errorDe('fechaEvaluacion') ? (
              <div className="invalid-feedback">{errores.fechaEvaluacion}</div>
            ) : null}
          </div>

          <div className="col-12 col-md-8">
            <span className="form-label d-block">Resultado *</span>
            <div
              className="btn-group flex-wrap"
              role="group"
              aria-label="Resultado de la evaluación"
            >
              {RESULTADOS_EVALUACION.map((resultado) => {
                const id = `resultado-${resultado.replace(/\s/g, '-').toLowerCase()}`;
                // Bootstrap marca el botón con el selector `.btn-check:checked + .btn`,
                // por eso cada radio debe ir inmediatamente seguido de su propia etiqueta.
                return (
                  <Fragment key={resultado}>
                    <input
                      className={`btn-check ${errorDe('resultado') ? 'is-invalid' : ''}`.trim()}
                      type="radio"
                      name="resultado"
                      id={id}
                      value={resultado}
                      checked={formulario.resultado === resultado}
                      onChange={cambiarCampo}
                    />
                    <label className={`btn ${COLOR_RESULTADO[resultado]}`} htmlFor={id}>
                      {formulario.resultado === resultado ? (
                        <i className="bi bi-check-lg me-1" aria-hidden="true" />
                      ) : null}
                      {resultado}
                    </label>
                  </Fragment>
                );
              })}
            </div>
            {errorDe('resultado') ? (
              <div className="text-danger small mt-1">{errores.resultado}</div>
            ) : null}
          </div>

          <div className="col-12">
            <label className="form-label" htmlFor="observaciones-evaluacion">
              Observaciones *
            </label>
            <textarea
              id="observaciones-evaluacion"
              name="observaciones"
              rows={4}
              className={`form-control ${errorDe('observaciones') ? 'is-invalid' : ''}`.trim()}
              placeholder="Conclusiones de la evaluación"
              value={formulario.observaciones}
              onChange={cambiarCampo}
            />
            {errorDe('observaciones') ? (
              <div className="invalid-feedback">{errores.observaciones}</div>
            ) : null}
          </div>

          <div className="col-12">
            <SeccionCompetencias
              competencias={formulario.competencias}
              alCambiar={cambiarCompetencias}
              errores={intentoEnvio ? errores : {}}
            />
          </div>
        </div>
      </div>
      <div className="card-footer bg-white d-flex justify-content-end">
        <button type="submit" className="btn btn-success">
          {evaluacion ? 'Actualizar evaluación' : 'Registrar evaluación'}
        </button>
      </div>
    </form>
  );
}
