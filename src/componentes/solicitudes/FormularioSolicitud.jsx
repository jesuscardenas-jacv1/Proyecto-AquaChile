import { useState } from 'react';
import { FAMILIAS_CARGO, PROFESIONALES } from '../../datos/constantes';
import { hayErrores, validarSolicitud } from '../../dominio/validaciones';
import Mensaje from '../comunes/Mensaje';

const CAMPOS_INICIALES = {
  candidatoId: '',
  cargo: '',
  familiaCargo: '',
  fechaSolicitud: new Date().toISOString().slice(0, 10),
  profesionalResponsable: '',
  observaciones: '',
};

/**
 * Formulario de creación de solicitudes de evaluación.
 * Al elegir un candidato se completan cargo y familia de cargo.
 */
export default function FormularioSolicitud({ candidatos = [], alGuardar, alCancelar }) {
  const [formulario, setFormulario] = useState(CAMPOS_INICIALES);
  const [errores, setErrores] = useState({});
  const [intentoEnvio, setIntentoEnvio] = useState(false);

  const cambiarCampo = (evento) => {
    const { name, value } = evento.target;
    setFormulario((actual) => ({ ...actual, [name]: value }));
    setErrores((actual) => ({ ...actual, [name]: undefined }));
  };

  const seleccionarCandidato = (evento) => {
    const candidatoId = evento.target.value;
    const candidato = candidatos.find((item) => String(item.id) === candidatoId);

    setFormulario((actual) => ({
      ...actual,
      candidatoId,
      cargo: candidato ? candidato.cargo : actual.cargo,
      familiaCargo: candidato ? candidato.familiaCargo : actual.familiaCargo,
    }));
    setErrores((actual) => ({ ...actual, candidatoId: undefined, cargo: undefined }));
  };

  const manejarEnvio = (evento) => {
    evento.preventDefault();
    setIntentoEnvio(true);
    const nuevosErrores = validarSolicitud(formulario, candidatos);
    setErrores(nuevosErrores);

    if (hayErrores(nuevosErrores)) return;
    alGuardar(formulario);
  };

  const errorDe = (campo) => (intentoEnvio ? errores[campo] : undefined);

  return (
    <form className="card border-0 shadow-sm" onSubmit={manejarEnvio} noValidate>
      <div className="card-header bg-white">
        <h2 className="h5 mb-0">Nueva solicitud de evaluación</h2>
      </div>
      <div className="card-body">
        {intentoEnvio && hayErrores(errores) ? (
          <Mensaje tipo="danger" titulo="Revisa los datos del formulario">
            Hay campos obligatorios o con formato inválido.
          </Mensaje>
        ) : null}

        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="candidatoId">
              Candidato *
            </label>
            <select
              id="candidatoId"
              name="candidatoId"
              className={`form-select ${errorDe('candidatoId') ? 'is-invalid' : ''}`.trim()}
              value={formulario.candidatoId}
              onChange={seleccionarCandidato}
            >
              <option value="">Seleccione un candidato</option>
              {candidatos.map((candidato) => (
                <option key={candidato.id} value={candidato.id}>
                  {candidato.nombre} — {candidato.cargo}
                </option>
              ))}
            </select>
            {errorDe('candidatoId') ? (
              <div className="invalid-feedback">{errores.candidatoId}</div>
            ) : null}
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="fechaSolicitud">
              Fecha de solicitud *
            </label>
            <input
              id="fechaSolicitud"
              name="fechaSolicitud"
              type="date"
              className={`form-control ${errorDe('fechaSolicitud') ? 'is-invalid' : ''}`.trim()}
              value={formulario.fechaSolicitud}
              onChange={cambiarCampo}
            />
            {errorDe('fechaSolicitud') ? (
              <div className="invalid-feedback">{errores.fechaSolicitud}</div>
            ) : null}
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="cargo">
              Cargo evaluado *
            </label>
            <input
              id="cargo"
              name="cargo"
              type="text"
              className={`form-control ${errorDe('cargo') ? 'is-invalid' : ''}`.trim()}
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

          <div className="col-12">
            <label className="form-label" htmlFor="profesionalResponsable">
              Profesional responsable
            </label>
            <select
              id="profesionalResponsable"
              name="profesionalResponsable"
              className="form-select"
              value={formulario.profesionalResponsable}
              onChange={cambiarCampo}
            >
              <option value="">Sin asignar</option>
              {PROFESIONALES.map((profesional) => (
                <option key={profesional} value={profesional}>
                  {profesional}
                </option>
              ))}
            </select>
            <div className="form-text">
              Puedes asignar el profesional más adelante desde el detalle de la solicitud.
            </div>
          </div>

          <div className="col-12">
            <label className="form-label" htmlFor="observaciones">
              Observaciones
            </label>
            <textarea
              id="observaciones"
              name="observaciones"
              rows={3}
              className="form-control"
              placeholder="Antecedentes relevantes del candidato"
              value={formulario.observaciones}
              onChange={cambiarCampo}
            />
          </div>
        </div>
      </div>
      <div className="card-footer bg-white d-flex flex-column flex-sm-row justify-content-between gap-2">
        <span className="small text-secondary align-self-sm-center">
          Al crear la solicitud queda en estado <strong>Pendiente</strong>.
        </span>
        <div className="d-flex gap-2">
          {alCancelar ? (
            <button type="button" className="btn btn-outline-secondary" onClick={alCancelar}>
              Cancelar
            </button>
          ) : null}
          <button type="submit" className="btn btn-primary">
            Crear solicitud
          </button>
        </div>
      </div>
    </form>
  );
}
