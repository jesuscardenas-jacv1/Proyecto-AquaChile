import { useState } from 'react';
import { FAMILIAS_CARGO } from '../../datos/constantes';
import { hayErrores, validarCandidato } from '../../dominio/validaciones';
import Mensaje from '../comunes/Mensaje';

const CAMPOS_INICIALES = {
  nombre: '',
  correo: '',
  telefono: '',
  cargo: '',
  familiaCargo: '',
};

const construirEstadoInicial = (candidato) => ({ ...CAMPOS_INICIALES, ...candidato });

/**
 * Formulario de registro y edición de candidatos.
 * @param {Object} props
 * @param {Object} props.candidato candidato a editar (opcional)
 * @param {Function} props.alGuardar callback con los datos válidos del candidato
 * @param {Function} props.alCancelar callback al cancelar
 */
export default function FormularioCandidato({
  candidato = null,
  alGuardar,
  alCancelar,
  titulo = 'Registrar candidato',
}) {
  const [formulario, setFormulario] = useState(() => construirEstadoInicial(candidato));
  const [errores, setErrores] = useState({});
  const [intentoEnvio, setIntentoEnvio] = useState(false);

  const cambiarCampo = (evento) => {
    const { name, value } = evento.target;
    setFormulario((actual) => ({ ...actual, [name]: value }));
    setErrores((actual) => ({ ...actual, [name]: undefined }));
  };

  const manejarEnvio = (evento) => {
    evento.preventDefault();
    setIntentoEnvio(true);
    const nuevosErrores = validarCandidato(formulario);
    setErrores(nuevosErrores);

    if (hayErrores(nuevosErrores)) return;

    alGuardar({
      ...formulario,
      nombre: formulario.nombre.trim(),
      correo: formulario.correo.trim(),
      telefono: formulario.telefono.trim(),
      cargo: formulario.cargo.trim(),
    });
  };

  const errorDe = (campo) => (intentoEnvio ? errores[campo] : undefined);

  return (
    <form className="card border-0 shadow-sm" onSubmit={manejarEnvio} noValidate>
      <div className="card-header bg-white">
        <h2 className="h5 mb-0">{titulo}</h2>
      </div>
      <div className="card-body">
        {intentoEnvio && hayErrores(errores) ? (
          <Mensaje tipo="danger" titulo="Revisa los datos del formulario">
            Existen campos obligatorios o con formato inválido.
          </Mensaje>
        ) : null}

        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="nombre">
              Nombre completo *
            </label>
            <input
              id="nombre"
              name="nombre"
              type="text"
              className={`form-control ${errorDe('nombre') ? 'is-invalid' : ''}`.trim()}
              placeholder="Ej: María González"
              value={formulario.nombre}
              onChange={cambiarCampo}
            />
            {errorDe('nombre') ? (
              <div className="invalid-feedback">{errores.nombre}</div>
            ) : null}
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="correo">
              Correo electrónico *
            </label>
            <input
              id="correo"
              name="correo"
              type="email"
              className={`form-control ${errorDe('correo') ? 'is-invalid' : ''}`.trim()}
              placeholder="nombre@dominio.cl"
              value={formulario.correo}
              onChange={cambiarCampo}
            />
            {errorDe('correo') ? (
              <div className="invalid-feedback">{errores.correo}</div>
            ) : null}
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="telefono">
              Teléfono *
            </label>
            <input
              id="telefono"
              name="telefono"
              type="tel"
              className={`form-control ${errorDe('telefono') ? 'is-invalid' : ''}`.trim()}
              placeholder="+56912345678"
              value={formulario.telefono}
              onChange={cambiarCampo}
            />
            {errorDe('telefono') ? (
              <div className="invalid-feedback">{errores.telefono}</div>
            ) : null}
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="cargo">
              Cargo *
            </label>
            <input
              id="cargo"
              name="cargo"
              type="text"
              className={`form-control ${errorDe('cargo') ? 'is-invalid' : ''}`.trim()}
              placeholder="Ej: Técnico de Planta"
              value={formulario.cargo}
              onChange={cambiarCampo}
            />
            {errorDe('cargo') ? (
              <div className="invalid-feedback">{errores.cargo}</div>
            ) : null}
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="familiaCargo">
              Familia de cargo *
            </label>
            <select
              id="familiaCargo"
              name="familiaCargo"
              className={`form-select ${errorDe('familiaCargo') ? 'is-invalid' : ''}`.trim()}
              value={formulario.familiaCargo}
              onChange={cambiarCampo}
            >
              <option value="">Seleccione una familia</option>
              {FAMILIAS_CARGO.map((familia) => (
                <option key={familia} value={familia}>
                  {familia}
                </option>
              ))}
            </select>
            {errorDe('familiaCargo') ? (
              <div className="invalid-feedback">{errores.familiaCargo}</div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="card-footer bg-white d-flex flex-column flex-sm-row justify-content-end gap-2">
        {alCancelar ? (
          <button type="button" className="btn btn-outline-secondary" onClick={alCancelar}>
            Cancelar
          </button>
        ) : null}
        <button type="submit" className="btn btn-primary">
          {candidato ? 'Guardar cambios' : 'Registrar candidato'}
        </button>
      </div>
    </form>
  );
}
