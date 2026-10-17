import { useState } from 'react';
import { ARCHIVOS_CV } from '../../datos/constantes';
import { validarPostulacion } from '../../dominio/postulaciones';
import { hayErrores } from '../../dominio/validaciones';
import Mensaje from '../comunes/Mensaje';

const camposIniciales = {
  nombre: '',
  correo: '',
  telefono: '',
  ciudad: '',
  origen: '',
  cv: null,
  consentimiento: false,
};

const clasesCampo = (base, error) => `${base} ${error ? 'is-invalid' : ''}`.trim();

/**
 * Formulario público de postulación a una oferta (réplica simplificada del portal
 * "Trabaja con nosotros" de AquaChile): datos de contacto, currículum y consentimiento.
 */
export default function FormularioPostulacion({ alEnviar, enviando = false }) {
  const [formulario, setFormulario] = useState(camposIniciales);
  const [errores, setErrores] = useState({});
  const [intentoEnvio, setIntentoEnvio] = useState(false);

  const actualizar = (campo, valor) => {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
    setErrores((actual) => {
      const siguientes = { ...actual };
      delete siguientes[campo];
      return siguientes;
    });
  };

  const cambiarCampo = (evento) => actualizar(evento.target.name, evento.target.value);

  const seleccionarCv = (evento) => {
    const archivo = evento.target.files?.[0] ?? null;
    if (archivo && archivo.size > ARCHIVOS_CV.tamanoMaximoMb * 1024 * 1024) {
      evento.target.value = '';
      actualizar('cv', null);
      setErrores((actual) => ({
        ...actual,
        cv: `El archivo supera el límite de ${ARCHIVOS_CV.tamanoMaximoMb} MB.`,
      }));
      return;
    }
    actualizar('cv', archivo);
  };

  const manejarEnvio = (evento) => {
    evento.preventDefault();
    setIntentoEnvio(true);
    const nuevosErrores = validarPostulacion(formulario);
    setErrores(nuevosErrores);
    if (hayErrores(nuevosErrores)) return;

    alEnviar({
      nombre: formulario.nombre.trim(),
      correo: formulario.correo.trim().toLowerCase(),
      telefono: formulario.telefono.replace(/[\s-]/g, ''),
      ciudad: formulario.ciudad.trim(),
      origen: formulario.origen,
      cv: formulario.cv,
      cvNombre: formulario.cv.name,
    });
  };

  const errorDe = (campo) => (intentoEnvio || campo === 'cv' ? errores[campo] : undefined);

  const campoTexto = (nombre, etiqueta, { tipo = 'text', placeholder, autoComplete } = {}) => (
    <div className="col-12 col-md-6">
      <label className="form-label" htmlFor={`postulacion-${nombre}`}>
        {etiqueta} *
      </label>
      <input
        id={`postulacion-${nombre}`}
        name={nombre}
        type={tipo}
        className={clasesCampo('form-control', errorDe(nombre))}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={formulario[nombre]}
        onChange={cambiarCampo}
      />
      {errorDe(nombre) ? <div className="invalid-feedback">{errorDe(nombre)}</div> : null}
    </div>
  );

  return (
    <form className="card border-0 shadow-sm" onSubmit={manejarEnvio} noValidate>
      <div className="card-header bg-white">
        <h2 className="h5 mb-0">Postula a esta oferta</h2>
        <small className="text-secondary">Los campos marcados con * son obligatorios.</small>
      </div>
      <div className="card-body">
        {intentoEnvio && hayErrores(errores) ? (
          <Mensaje tipo="danger" titulo="Revisa los datos del formulario">
            Hay campos incompletos o con errores.
          </Mensaje>
        ) : null}

        <div className="row g-3">
          {campoTexto('nombre', 'Nombre completo', { placeholder: 'Ej: María González', autoComplete: 'name' })}
          {campoTexto('correo', 'Correo electrónico', {
            tipo: 'email',
            placeholder: 'nombre@dominio.cl',
            autoComplete: 'email',
          })}
          {campoTexto('telefono', 'Teléfono', { tipo: 'tel', placeholder: '+56912345678', autoComplete: 'tel' })}
          {campoTexto('ciudad', 'Ciudad de residencia', { placeholder: 'Ej: Puerto Montt' })}

          <fieldset className="col-12">
            <legend className="form-label fs-6">¿Trabajas actualmente en AquaChile? *</legend>
            {[
              ['Interno', 'Sí'],
              ['Externo', 'No'],
            ].map(([valor, etiqueta]) => (
              <div key={valor} className="form-check form-check-inline">
                <input
                  id={`postulacion-origen-${valor}`}
                  className={clasesCampo('form-check-input', errorDe('origen'))}
                  type="radio"
                  name="origen"
                  value={valor}
                  checked={formulario.origen === valor}
                  onChange={cambiarCampo}
                />
                <label className="form-check-label" htmlFor={`postulacion-origen-${valor}`}>
                  {etiqueta}
                </label>
              </div>
            ))}
            {errorDe('origen') ? <div className="invalid-feedback d-block">{errorDe('origen')}</div> : null}
          </fieldset>

          <div className="col-12">
            <label className="form-label" htmlFor="postulacion-cv">
              Currículum (CV) *
            </label>
            <input
              id="postulacion-cv"
              type="file"
              className={clasesCampo('form-control', errorDe('cv'))}
              accept={ARCHIVOS_CV.extensiones}
              onChange={seleccionarCv}
            />
            {errorDe('cv') ? <div className="invalid-feedback">{errorDe('cv')}</div> : null}
            <div className="form-text">
              {ARCHIVOS_CV.descripcion}, hasta {ARCHIVOS_CV.tamanoMaximoMb} MB.
            </div>
          </div>

          <div className="col-12">
            <div className="form-check">
              <input
                id="postulacion-consentimiento"
                className={clasesCampo('form-check-input', errorDe('consentimiento'))}
                type="checkbox"
                checked={formulario.consentimiento}
                onChange={(evento) => actualizar('consentimiento', evento.target.checked)}
              />
              <label className="form-check-label small" htmlFor="postulacion-consentimiento">
                Acepto que AquaChile use mis datos y mi currículum solo para este proceso de selección. *
              </label>
              {errorDe('consentimiento') ? (
                <div className="invalid-feedback d-block">{errorDe('consentimiento')}</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div className="card-footer bg-white d-flex justify-content-end">
        <button type="submit" className="btn btn-primary" disabled={enviando}>
          {enviando ? (
            <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
          ) : (
            <i className="bi bi-send me-1" aria-hidden="true" />
          )}
          Enviar postulación
        </button>
      </div>
    </form>
  );
}
