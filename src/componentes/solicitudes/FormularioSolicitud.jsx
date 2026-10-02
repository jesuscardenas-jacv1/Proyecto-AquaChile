import { useState } from 'react';
import {
  ARCHIVOS_PERMITIDOS,
  FAMILIAS_CARGO,
  OPCIONES_SI_NO,
  ORIGENES_CANDIDATO,
  PROFESIONALES,
} from '../../datos/constantes';
import { CARGOS, UBICACIONES, buscarCargo, unidadDeUbicacion } from '../../datos/catalogos';
import { normalizar } from '../../dominio/texto';
import { hayErrores, validarFormularioSolicitud } from '../../dominio/validaciones';
import Mensaje from '../comunes/Mensaje';

const camposIniciales = () => ({
  profesionalResponsable: '',
  candidatoId: '',
  nombreCandidato: '',
  correo: '',
  telefono: '',
  origen: '',
  referido: '',
  cargo: '',
  familiaCargo: '',
  ubicacion: '',
  ceco: '',
  requiereReferencias: '',
  cv: '',
  descriptorAdjunto: '',
  observaciones: '',
  fechaSolicitud: new Date().toISOString().slice(0, 10),
});

const clasesCampo = (base, error) => `${base} ${error ? 'is-invalid' : ''}`.trim();

/** Grupo de opciones excluyentes (radio buttons) con su leyenda y mensaje de error. */
function GrupoOpciones({
  nombre,
  etiqueta,
  opciones,
  valor,
  alCambiar,
  error,
  obligatorio,
  ayuda,
}) {
  return (
    <fieldset>
      <legend className="form-label fs-6">
        {etiqueta}
        {obligatorio ? ' *' : ''}
      </legend>
      <div>
        {opciones.map((opcion) => (
          <div key={opcion} className="form-check form-check-inline">
            <input
              id={`${nombre}-${normalizar(opcion).replace(/\s+/g, '-')}`}
              className={clasesCampo('form-check-input', error)}
              type="radio"
              name={nombre}
              value={opcion}
              checked={valor === opcion}
              onChange={alCambiar}
            />
            <label
              className="form-check-label"
              htmlFor={`${nombre}-${normalizar(opcion).replace(/\s+/g, '-')}`}
            >
              {opcion}
            </label>
          </div>
        ))}
      </div>
      {ayuda ? <div className="form-text">{ayuda}</div> : null}
      {error ? <div className="invalid-feedback d-block">{error}</div> : null}
    </fieldset>
  );
}

/** Campo para adjuntar un archivo; en el MVP solo se registra el nombre del archivo. */
function CampoArchivo({ id, etiqueta, archivo, alSeleccionar, alQuitar, error }) {
  return (
    <div>
      <label className="form-label" htmlFor={id}>
        {etiqueta}
      </label>
      {archivo ? (
        <div className="d-flex align-items-center gap-2 border rounded px-3 py-2 bg-white">
          <i className="bi bi-paperclip text-secondary" aria-hidden="true" />
          <span className="flex-grow-1 text-break small">{archivo}</span>
          <button
            type="button"
            className="btn btn-sm btn-link text-danger p-0"
            onClick={alQuitar}
            aria-label={`Quitar ${archivo}`}
          >
            Quitar
          </button>
        </div>
      ) : (
        <input
          id={id}
          type="file"
          className={clasesCampo('form-control', error)}
          accept={ARCHIVOS_PERMITIDOS.extensiones}
          onChange={alSeleccionar}
        />
      )}
      {error ? <div className="invalid-feedback d-block">{error}</div> : null}
      <div className="form-text">
        1 archivo de hasta {ARCHIVOS_PERMITIDOS.tamanoMaximoMb} MB (
        {ARCHIVOS_PERMITIDOS.descripcion}).
      </div>
    </div>
  );
}

/**
 * Formulario de solicitud de evaluación psicolaboral (réplica del Microsoft Forms).
 * Automatiza los datos derivables: al escribir un candidato registrado completa su origen
 * y cargo; el cargo completa la familia y el descriptor, y la ubicación la unidad.
 */
export default function FormularioSolicitud({ candidatos = [], alGuardar, alCancelar }) {
  const [formulario, setFormulario] = useState(camposIniciales);
  const [errores, setErrores] = useState({});
  const [intentoEnvio, setIntentoEnvio] = useState(false);

  const candidatoRegistrado = candidatos.find(
    (candidato) => String(candidato.id) === String(formulario.candidatoId),
  );
  const cargoCatalogo = buscarCargo(formulario.cargo);
  const descriptorAutomatico = cargoCatalogo?.descriptorCargo ?? '';
  const unidad = unidadDeUbicacion(formulario.ubicacion);
  const esExterno = formulario.origen === 'Externo';

  const actualizar = (cambios, camposConError = Object.keys(cambios)) => {
    setFormulario((actual) => ({ ...actual, ...cambios }));
    setErrores((actual) => {
      const siguientes = { ...actual };
      camposConError.forEach((campo) => delete siguientes[campo]);
      return siguientes;
    });
  };

  const cambiarCampo = (evento) => {
    const { name, value } = evento.target;
    actualizar({ [name]: value });
  };

  const cambiarCandidato = (evento) => {
    const nombreCandidato = evento.target.value;
    const candidato = candidatos.find(
      (item) => normalizar(item.nombre.trim()) === normalizar(nombreCandidato.trim()),
    );
    if (!candidato) {
      actualizar({ nombreCandidato, candidatoId: '' });
      return;
    }
    const cargo = buscarCargo(candidato.cargo);
    actualizar(
      {
        nombreCandidato,
        candidatoId: String(candidato.id),
        origen: candidato.origen || formulario.origen,
        cargo: candidato.cargo,
        familiaCargo: cargo?.familiaCargo ?? candidato.familiaCargo,
      },
      ['nombreCandidato', 'correo', 'telefono', 'origen', 'cargo', 'familiaCargo'],
    );
  };

  const cambiarOrigen = (evento) => {
    const origen = evento.target.value;
    actualizar({ origen, referido: origen === 'Externo' ? formulario.referido : '' });
  };

  const cambiarCargo = (evento) => {
    const cargo = evento.target.value;
    const encontrado = buscarCargo(cargo);
    actualizar(encontrado ? { cargo, familiaCargo: encontrado.familiaCargo } : { cargo }, [
      'cargo',
      'familiaCargo',
    ]);
  };

  const seleccionarArchivo = (campo) => (evento) => {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    if (archivo.size > ARCHIVOS_PERMITIDOS.tamanoMaximoMb * 1024 * 1024) {
      setErrores((actual) => ({
        ...actual,
        [campo]: `El archivo supera el límite de ${ARCHIVOS_PERMITIDOS.tamanoMaximoMb} MB.`,
      }));
      evento.target.value = '';
      return;
    }
    actualizar({ [campo]: archivo.name });
  };

  const manejarEnvio = (evento) => {
    evento.preventDefault();
    setIntentoEnvio(true);
    const nuevosErrores = validarFormularioSolicitud(formulario, candidatos);
    setErrores(nuevosErrores);
    if (hayErrores(nuevosErrores)) return;

    const { descriptorAdjunto, ...datos } = formulario;
    alGuardar({
      ...datos,
      nombreCandidato: datos.nombreCandidato.trim(),
      cargo: datos.cargo.trim(),
      ubicacion: datos.ubicacion.trim(),
      unidad,
      ceco: datos.ceco.trim().toUpperCase(),
      requiereReferencias: datos.requiereReferencias === 'Sí',
      referido: esExterno && datos.referido ? datos.referido === 'Sí' : null,
      tipoEvaluacion: datos.origen === 'Interno' ? 'interna' : 'externa',
      descriptorCargo: descriptorAutomatico || descriptorAdjunto,
      observaciones: datos.observaciones.trim(),
    });
  };

  const errorDe = (campo) =>
    intentoEnvio || campo === 'cv' || campo === 'descriptorAdjunto' ? errores[campo] : undefined;

  return (
    <form className="card border-0 shadow-sm" onSubmit={manejarEnvio} noValidate>
      <div className="card-header bg-white">
        <h2 className="h5 mb-0">Solicitud de evaluación psicolaboral</h2>
        <small className="text-secondary">Los campos marcados con * son obligatorios.</small>
      </div>
      <div className="card-body d-flex flex-column gap-4">
        {intentoEnvio && hayErrores(errores) ? (
          <Mensaje tipo="danger" titulo="Revisa los datos del formulario">
            Hay campos obligatorios o con formato inválido.
          </Mensaje>
        ) : null}

        <section aria-labelledby="seccion-reclutador">
          <h3 id="seccion-reclutador" className="h6 text-secondary text-uppercase small mb-3">
            Reclutador/a
          </h3>
          <GrupoOpciones
            nombre="profesionalResponsable"
            etiqueta="Reclutador/a"
            opciones={PROFESIONALES}
            valor={formulario.profesionalResponsable}
            alCambiar={cambiarCampo}
            error={errorDe('profesionalResponsable')}
            obligatorio
          />
        </section>

        <section aria-labelledby="seccion-candidato">
          <h3 id="seccion-candidato" className="h6 text-secondary text-uppercase small mb-3">
            Candidato/a
          </h3>
          <div className="row g-3">
            <div className="col-12">
              <label className="form-label" htmlFor="nombreCandidato">
                Nombre del candidato/a *
              </label>
              <input
                id="nombreCandidato"
                name="nombreCandidato"
                type="text"
                list="candidatos-registrados"
                autoComplete="off"
                className={clasesCampo('form-control', errorDe('nombreCandidato'))}
                value={formulario.nombreCandidato}
                onChange={cambiarCandidato}
              />
              <datalist id="candidatos-registrados">
                {candidatos.map((candidato) => (
                  <option key={candidato.id} value={candidato.nombre} />
                ))}
              </datalist>
              {errorDe('nombreCandidato') ? (
                <div className="invalid-feedback">{errores.nombreCandidato}</div>
              ) : null}
              {candidatoRegistrado ? (
                <div className="form-text text-success">
                  <i className="bi bi-person-check me-1" aria-hidden="true" />
                  Candidato/a registrado/a: {candidatoRegistrado.correo} ·{' '}
                  {candidatoRegistrado.telefono}
                </div>
              ) : formulario.nombreCandidato.trim() ? (
                <div className="form-text">
                  <i className="bi bi-person-plus me-1" aria-hidden="true" />
                  No está registrado/a: se creará junto con la solicitud.
                </div>
              ) : (
                <div className="form-text">
                  Escribe el nombre; si ya está registrado/a se completan sus datos.
                </div>
              )}
            </div>

            {!candidatoRegistrado && formulario.nombreCandidato.trim() ? (
              <>
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="correo">
                    Correo del candidato/a *
                  </label>
                  <input
                    id="correo"
                    name="correo"
                    type="email"
                    className={clasesCampo('form-control', errorDe('correo'))}
                    value={formulario.correo}
                    onChange={cambiarCampo}
                  />
                  {errorDe('correo') ? (
                    <div className="invalid-feedback">{errores.correo}</div>
                  ) : null}
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label" htmlFor="telefono">
                    Teléfono del candidato/a *
                  </label>
                  <input
                    id="telefono"
                    name="telefono"
                    type="tel"
                    placeholder="+56912345678"
                    className={clasesCampo('form-control', errorDe('telefono'))}
                    value={formulario.telefono}
                    onChange={cambiarCampo}
                  />
                  {errorDe('telefono') ? (
                    <div className="invalid-feedback">{errores.telefono}</div>
                  ) : null}
                </div>
              </>
            ) : null}

            <div className="col-12 col-md-6">
              <GrupoOpciones
                nombre="origen"
                etiqueta="Origen del candidato/a"
                opciones={ORIGENES_CANDIDATO}
                valor={formulario.origen}
                alCambiar={cambiarOrigen}
                error={errorDe('origen')}
                obligatorio
              />
            </div>

            {esExterno ? (
              <div className="col-12 col-md-6">
                <GrupoOpciones
                  nombre="referido"
                  etiqueta="¿El candidato/a es referido/a?"
                  opciones={OPCIONES_SI_NO}
                  valor={formulario.referido}
                  alCambiar={cambiarCampo}
                  ayuda="Solo para candidatos externos."
                />
              </div>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="seccion-cargo">
          <h3 id="seccion-cargo" className="h6 text-secondary text-uppercase small mb-3">
            Cargo
          </h3>
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="cargo">
                Nombre del cargo *
              </label>
              <input
                id="cargo"
                name="cargo"
                type="text"
                list="cargos-catalogo"
                autoComplete="off"
                className={clasesCampo('form-control', errorDe('cargo'))}
                value={formulario.cargo}
                onChange={cambiarCargo}
              />
              <datalist id="cargos-catalogo">
                {CARGOS.map((cargo) => (
                  <option key={cargo.nombre} value={cargo.nombre} />
                ))}
              </datalist>
              {errorDe('cargo') ? <div className="invalid-feedback">{errores.cargo}</div> : null}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="familiaCargo">
                Familia del cargo *
              </label>
              <select
                id="familiaCargo"
                name="familiaCargo"
                className={clasesCampo('form-select', errorDe('familiaCargo'))}
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
              {cargoCatalogo ? (
                <div className="form-text">Completada según el cargo seleccionado.</div>
              ) : null}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="ubicacion">
                Ubicación del cargo *
              </label>
              <input
                id="ubicacion"
                name="ubicacion"
                type="text"
                list="ubicaciones-catalogo"
                autoComplete="off"
                className={clasesCampo('form-control', errorDe('ubicacion'))}
                value={formulario.ubicacion}
                onChange={cambiarCampo}
              />
              <datalist id="ubicaciones-catalogo">
                {UBICACIONES.map((ubicacion) => (
                  <option key={ubicacion.nombre} value={ubicacion.nombre} />
                ))}
              </datalist>
              {errorDe('ubicacion') ? (
                <div className="invalid-feedback">{errores.ubicacion}</div>
              ) : null}
              {unidad ? <div className="form-text">Unidad: {unidad}</div> : null}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="ceco">
                CECO *
              </label>
              <input
                id="ceco"
                name="ceco"
                type="text"
                placeholder="A170010311"
                className={clasesCampo('form-control', errorDe('ceco'))}
                value={formulario.ceco}
                onChange={cambiarCampo}
              />
              {errorDe('ceco') ? <div className="invalid-feedback">{errores.ceco}</div> : null}
            </div>

            <div className="col-12">
              <GrupoOpciones
                nombre="requiereReferencias"
                etiqueta="¿Requiere referencias?"
                opciones={OPCIONES_SI_NO}
                valor={formulario.requiereReferencias}
                alCambiar={cambiarCampo}
                error={errorDe('requiereReferencias')}
                obligatorio
              />
            </div>
          </div>
        </section>

        <section aria-labelledby="seccion-antecedentes">
          <h3 id="seccion-antecedentes" className="h6 text-secondary text-uppercase small mb-3">
            Antecedentes
          </h3>
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <CampoArchivo
                id="cv"
                etiqueta="Adjuntar CV"
                archivo={formulario.cv}
                alSeleccionar={seleccionarArchivo('cv')}
                alQuitar={() => actualizar({ cv: '' })}
                error={errorDe('cv')}
              />
            </div>

            <div className="col-12 col-md-6">
              {descriptorAutomatico ? (
                <div>
                  <span className="form-label d-block">Descriptor de cargo</span>
                  <div className="d-flex align-items-center gap-2 border rounded px-3 py-2 bg-body-tertiary">
                    <i className="bi bi-file-earmark-text text-secondary" aria-hidden="true" />
                    <span className="flex-grow-1 text-break small">{descriptorAutomatico}</span>
                  </div>
                  <div className="form-text">Asociado automáticamente al cargo.</div>
                </div>
              ) : (
                <CampoArchivo
                  id="descriptorAdjunto"
                  etiqueta="Adjuntar descriptor de cargo"
                  archivo={formulario.descriptorAdjunto}
                  alSeleccionar={seleccionarArchivo('descriptorAdjunto')}
                  alQuitar={() => actualizar({ descriptorAdjunto: '' })}
                  error={errorDe('descriptorAdjunto')}
                />
              )}
            </div>

            <div className="col-12">
              <label className="form-label" htmlFor="observaciones">
                Aspectos a indagar
              </label>
              <textarea
                id="observaciones"
                name="observaciones"
                rows={3}
                className="form-control"
                placeholder="Funciones del cargo, si es confidencial para el candidato, énfasis en alguna competencia, indagar en liderazgo, etc."
                value={formulario.observaciones}
                onChange={cambiarCampo}
              />
            </div>
          </div>
        </section>
      </div>
      <div className="card-footer bg-white d-flex flex-column flex-sm-row justify-content-between gap-2">
        <span className="small text-secondary align-self-sm-center">
          Al enviar, la solicitud queda en estado <strong>Pendiente</strong>.
        </span>
        <div className="d-flex gap-2">
          {alCancelar ? (
            <button type="button" className="btn btn-outline-secondary" onClick={alCancelar}>
              Cancelar
            </button>
          ) : null}
          <button type="submit" className="btn btn-primary">
            Enviar solicitud
          </button>
        </div>
      </div>
    </form>
  );
}
