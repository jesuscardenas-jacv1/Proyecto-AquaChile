import { useEffect, useRef, useState } from 'react';
import {
  ARCHIVOS_PERMITIDOS,
  CECOS,
  EVALUADORES,
  FAMILIAS_CARGO,
  OPCIONES_SI_NO,
  ORIGENES_CANDIDATO,
  RECLUTADORES,
} from '../../datos/constantes';
import {
  UBICACIONES,
  datosDeCargo,
  nombresDeCargos,
  resolverDescriptor,
  unidadDeUbicacion,
} from '../../datos/catalogos';
import { normalizar } from '../../dominio/texto';
import { hayErrores, seccionesDisponibles, validarFormularioSolicitud } from '../../dominio/validaciones';
import Mensaje from '../comunes/Mensaje';
import VentanaDocumento from './VentanaDocumento';
import { apiDocumentos, documentoCargo, documentoCatalogo } from '../../servicios/apiDocumentos';

const camposIniciales = () => ({
  reclutador: '',
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

/**
 * Sección numerada del formulario. Las siguientes a la que se está completando quedan
 * plegadas hasta que le toque su turno; los campos siguen en la página para conservar lo escrito.
 */
function SeccionFormulario({ id, numero, titulo, completa, disponible, children }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titulo`}
      className={`seccion-solicitud ${disponible ? '' : 'seccion-solicitud-pendiente'}`.trim()}
    >
      <h3 id={`${id}-titulo`} className="seccion-solicitud-titulo h6 mb-0">
        <span className={`seccion-solicitud-numero ${completa ? 'completa' : ''}`.trim()} aria-hidden="true">
          {completa ? <i className="bi bi-check-lg" /> : numero}
        </span>
        {titulo}
        {!disponible ? <small className="fw-normal text-secondary ms-auto">Completa la sección anterior</small> : null}
        {disponible && completa ? <span className="visually-hidden"> (completa)</span> : null}
      </h3>
      <div className={`seccion-solicitud-cuerpo ${disponible ? '' : 'd-none'}`.trim()}>{children}</div>
    </section>
  );
}

/** Nombre de un documento ya definido, con el botón del ojo para verlo sin salir del formulario. */
function DocumentoDefinido({ icono, etiqueta, nombre, alVer, ayuda }) {
  return (
    <div>
      <span className="form-label d-block">{etiqueta}</span>
      <div className="dato-heredado d-flex align-items-center gap-2 border rounded px-3 py-2">
        <i className={`bi ${icono} text-secondary`} aria-hidden="true" />
        <span className="flex-grow-1 text-break small">{nombre}</span>
        <button
          type="button"
          className="btn btn-sm btn-outline-primary py-0 px-2"
          onClick={alVer}
          disabled={!alVer}
          aria-label={`Ver ${nombre}`}
          title={alVer ? 'Vista previa' : 'Este documento no tiene archivo para mostrar'}
        >
          <i className="bi bi-eye" aria-hidden="true" />
        </button>
      </div>
      {ayuda ? <div className="form-text">{ayuda}</div> : null}
    </div>
  );
}

/** Entrega un archivo recién elegido al navegador, para descargarlo desde la vista previa. */
function descargarArchivoLocal(archivo) {
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = archivo.name;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Campo para adjuntar un archivo: el nombre va en la solicitud y el archivo, a su carpeta. */
function CampoArchivo({ id, etiqueta, archivo, alSeleccionar, alQuitar, alVer, error, ayuda = '' }) {
  return (
    <div>
      <label className="form-label" htmlFor={id}>
        {etiqueta}
      </label>
      {archivo ? (
        <div className="d-flex align-items-center gap-2 border rounded px-3 py-2 bg-white">
          <i className="bi bi-paperclip text-secondary" aria-hidden="true" />
          <span className="flex-grow-1 text-break small">{archivo}</span>
          {alVer ? (
            <button
              type="button"
              className="btn btn-sm btn-outline-primary py-0 px-2"
              onClick={alVer}
              aria-label={`Ver ${archivo}`}
              title="Vista previa"
            >
              <i className="bi bi-eye" aria-hidden="true" />
            </button>
          ) : null}
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
        {ayuda ? ` ${ayuda}` : ''}
      </div>
    </div>
  );
}

/** Ficha de solo lectura del postulante que llega desde el portal "Trabaja con nosotros". */
function FichaPostulante({ postulante }) {
  return (
    <div className="dato-heredado border rounded p-3" aria-label="Datos del postulante">
      <p className="fw-semibold mb-1">{postulante.nombre}</p>
      <p className="small text-secondary mb-1">
        {[postulante.correo, postulante.telefono, postulante.origen].filter(Boolean).join(' · ')}
      </p>
      <small className="text-secondary">Datos que el postulante ingresó en el portal.</small>
    </div>
  );
}

/**
 * Formulario de solicitud de evaluación psicolaboral (réplica del Microsoft Forms).
 * Automatiza los datos derivables: al escribir un candidato registrado completa su origen
 * y cargo; el cargo completa la familia y el descriptor, y la ubicación la unidad.
 *
 * - `reclutadorFijo`: quien pide la evaluación es el analista con sesión; se muestra y no se
 *   pregunta. Sin él (administrador) se elige de la lista de reclutadores.
 * - `postulante`: viene del portal; sus datos ya se conocen y se muestran como ficha.
 * - `cargosGuardados`: cargos con su descriptor; si el cargo tiene uno, no se pide adjuntarlo.
 * - `oferta`: de dónde viene la postulación; una oferta antigua puede tener descriptor propio.
 * - `documentosOrigen`: { cv, descriptor }, cada uno con { contenido, descargar } para ver los
 *   archivos que vienen de la postulación y de esa oferta.
 *
 * Las secciones se despliegan a medida que se completan, y lo heredado del proceso anterior se
 * distingue por su color: sigue siendo editable y, al cambiarlo, pasa a verse como un dato propio.
 */
export default function FormularioSolicitud({
  candidatos = [],
  alGuardar,
  alCancelar,
  valoresIniciales = {},
  reclutadorFijo = '',
  postulante = null,
  cargosGuardados = [],
  oferta = null,
  documentosOrigen = {},
}) {
  // valoresIniciales permite partir con datos ya conocidos (p. ej. desde una postulación).
  const [formulario, setFormulario] = useState(() => ({
    ...camposIniciales(),
    ...(reclutadorFijo ? { reclutador: reclutadorFijo } : {}),
    ...valoresIniciales,
  }));
  const [errores, setErrores] = useState({});
  const [intentoEnvio, setIntentoEnvio] = useState(false);
  // Los archivos elegidos: la página los sube a la carpeta al crear la solicitud.
  const [adjuntos, setAdjuntos] = useState({});
  const [documentoAbierto, setDocumentoAbierto] = useState(null);
  // Una sección ya desplegada no se vuelve a plegar aunque se corrija un dato anterior.
  const refDisponibles = useRef(0);
  const disponibles = intentoEnvio
    ? Number.POSITIVE_INFINITY
    : Math.max(refDisponibles.current, seccionesDisponibles(formulario, candidatos));
  refDisponibles.current = disponibles;
  const refUltimaDisponible = useRef(disponibles);

  // Al desplegarse una sección, se muestra sin mover lo que ya está a la vista.
  useEffect(() => {
    if (disponibles === refUltimaDisponible.current || !Number.isFinite(disponibles)) return;
    refUltimaDisponible.current = disponibles;
    const id = ['seccion-candidato', 'seccion-cargo', 'seccion-evaluacion', 'seccion-antecedentes'][disponibles - 1];
    document.getElementById(id)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [disponibles]);

  // Lo heredado mantiene su color mientras siga igual a como llegó.
  const esHeredado = (campo) =>
    Boolean(postulante) && Boolean(formulario[campo]) && formulario[campo] === valoresIniciales[campo];
  const claseHeredado = (campo) => (esHeredado(campo) ? 'dato-heredado' : '');
  const avisoHeredado = (campo) =>
    esHeredado(campo) ? (
      <div className="form-text">
        <i className="bi bi-pencil me-1" aria-hidden="true" />
        Viene de la oferta. Puedes editarlo.
      </div>
    ) : null;

  const candidatoRegistrado = candidatos.find(
    (candidato) => String(candidato.id) === String(formulario.candidatoId),
  );
  const cargoCatalogo = datosDeCargo(formulario.cargo, cargosGuardados);
  const descriptor = resolverDescriptor({ cargo: formulario.cargo, cargosGuardados, oferta });
  const descriptorAutomatico = descriptor.nombre;
  const visorDescriptor = {
    cargo: () => (apiDocumentos.conectado() ? documentoCargo(descriptor.cargoGuardado) : null),
    oferta: () => documentosOrigen.descriptor,
    catalogo: () => documentoCatalogo(descriptor.nombre),
  }[descriptor.origen]?.();
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
    const cargo = datosDeCargo(candidato.cargo, cargosGuardados);
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
    const encontrado = datosDeCargo(cargo, cargosGuardados);
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
    setAdjuntos((actual) => ({ ...actual, [campo]: archivo }));
    actualizar({ [campo]: archivo.name });
  };

  const verAdjunto = (archivo) => () =>
    setDocumentoAbierto({
      archivo: { nombre: archivo.name },
      api: { contenido: async () => archivo, descargar: async () => descargarArchivoLocal(archivo) },
    });

  const verOrigen = (origen, nombre) =>
    origen ? () => setDocumentoAbierto({ archivo: { nombre }, api: origen }) : null;

  const quitarAdjunto = (campo) => {
    setAdjuntos(({ [campo]: _quitado, ...resto }) => resto);
    actualizar({ [campo]: '' });
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
      archivos: {
        ...(adjuntos.cv ? { cv: adjuntos.cv } : {}),
        ...(!descriptorAutomatico && adjuntos.descriptorAdjunto ? { descriptor: adjuntos.descriptorAdjunto } : {}),
      },
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

        {reclutadorFijo ? (
          <p className="mb-0 small">
            <i className="bi bi-person-badge me-1 text-secondary" aria-hidden="true" />
            Solicita: <strong>{reclutadorFijo}</strong>
          </p>
        ) : (
          <section aria-labelledby="seccion-reclutador">
            <h3 id="seccion-reclutador" className="h6 text-secondary text-uppercase small mb-3">
              Reclutador/a
            </h3>
            <GrupoOpciones
              nombre="reclutador"
              etiqueta="Reclutador/a que solicita"
              opciones={RECLUTADORES}
              valor={formulario.reclutador}
              alCambiar={cambiarCampo}
              error={errorDe('reclutador')}
              obligatorio
            />
          </section>
        )}

        <SeccionFormulario
          id="seccion-candidato"
          numero={1}
          titulo="Candidato/a"
          disponible
          completa={disponibles > 1}
        >
          <div className="row g-3">
            {postulante ? (
              <div className="col-12">
                <FichaPostulante postulante={postulante} />
              </div>
            ) : null}

            {postulante ? null : (
            <div className="col-12">
              <label className="form-label" htmlFor="nombreCandidato">
                Candidato/a *
              </label>
              <input
                id="nombreCandidato"
                name="nombreCandidato"
                type="text"
                list="candidatos-registrados"
                autoComplete="off"
                placeholder="Buscar registrado o escribir uno nuevo"
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
                  Si ya está registrado/a, elígelo/a de la lista y se completan sus datos; si no, se
                  registra junto con la solicitud.
                </div>
              )}
            </div>
            )}

            {!postulante && !candidatoRegistrado && formulario.nombreCandidato.trim() ? (
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

            {postulante?.origen ? null : (
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
            )}

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
        </SeccionFormulario>

        <SeccionFormulario
          id="seccion-cargo"
          numero={2}
          titulo="Cargo"
          disponible={disponibles >= 2}
          completa={disponibles > 2}
        >
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
                className={clasesCampo(`form-control ${claseHeredado('cargo')}`, errorDe('cargo'))}
                value={formulario.cargo}
                onChange={cambiarCargo}
              />
              <datalist id="cargos-catalogo">
                {nombresDeCargos(cargosGuardados).map((nombre) => (
                  <option key={nombre} value={nombre} />
                ))}
              </datalist>
              {errorDe('cargo') ? <div className="invalid-feedback">{errores.cargo}</div> : null}
              {avisoHeredado('cargo')}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="familiaCargo">
                Familia del cargo *
              </label>
              <select
                id="familiaCargo"
                name="familiaCargo"
                className={clasesCampo(`form-select ${claseHeredado('familiaCargo')}`, errorDe('familiaCargo'))}
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
              {avisoHeredado('familiaCargo') ??
                (cargoCatalogo ? <div className="form-text">Completada según el cargo seleccionado.</div> : null)}
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
                className={clasesCampo(`form-control ${claseHeredado('ubicacion')}`, errorDe('ubicacion'))}
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
              {avisoHeredado('ubicacion')}
              {unidad ? <div className="form-text">Unidad: {unidad}</div> : null}
            </div>

            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="ceco">
                CECO *
              </label>
              <select
                id="ceco"
                name="ceco"
                className={clasesCampo('form-select', errorDe('ceco'))}
                value={formulario.ceco}
                onChange={cambiarCampo}
              >
                <option value="">Seleccione un CECO</option>
                {CECOS.map(({ codigo, nombre }) => (
                  <option key={codigo} value={codigo}>
                    {codigo} · {nombre}
                  </option>
                ))}
              </select>
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
        </SeccionFormulario>

        <SeccionFormulario
          id="seccion-evaluacion"
          numero={3}
          titulo="Evaluación"
          disponible={disponibles >= 3}
          completa={disponibles > 3}
        >
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="profesionalResponsable">
                Psicóloga responsable *
              </label>
              <select
                id="profesionalResponsable"
                name="profesionalResponsable"
                className={clasesCampo('form-select', errorDe('profesionalResponsable'))}
                value={formulario.profesionalResponsable}
                onChange={cambiarCampo}
              >
                <option value="">Seleccione una psicóloga</option>
                {EVALUADORES.map((nombre) => (
                  <option key={nombre} value={nombre}>
                    {nombre}
                  </option>
                ))}
              </select>
              {errorDe('profesionalResponsable') ? (
                <div className="invalid-feedback">{errores.profesionalResponsable}</div>
              ) : null}
              <div className="form-text">Recibirá un aviso con la nueva solicitud.</div>
            </div>
          </div>
        </SeccionFormulario>

        <SeccionFormulario
          id="seccion-antecedentes"
          numero={4}
          titulo="Antecedentes"
          disponible={disponibles >= 4}
          completa={false}
        >
          <div className="row g-3">
            <div className="col-12 col-md-6">
              {postulante ? (
                // El CV viene de la postulación: se copia solo a la carpeta de la solicitud.
                formulario.cv ? (
                  <DocumentoDefinido
                    icono="bi-file-earmark-person"
                    etiqueta="CV del postulante"
                    nombre={formulario.cv}
                    alVer={verOrigen(documentosOrigen.cv, formulario.cv)}
                    ayuda="Viene de la postulación; se guarda en la carpeta de la solicitud."
                  />
                ) : (
                  <div>
                    <span className="form-label d-block">CV del postulante</span>
                    <div className="form-text mt-0">
                      No adjuntó CV en el portal. Podrás subirlo después en Documentos de la solicitud.
                    </div>
                  </div>
                )
              ) : (
                <CampoArchivo
                  id="cv"
                  etiqueta="Adjuntar CV"
                  archivo={formulario.cv}
                  alSeleccionar={seleccionarArchivo('cv')}
                  alQuitar={() => quitarAdjunto('cv')}
                  alVer={adjuntos.cv ? verAdjunto(adjuntos.cv) : null}
                  error={errorDe('cv')}
                />
              )}
            </div>

            <div className="col-12 col-md-6">
              {descriptorAutomatico ? (
                <DocumentoDefinido
                  icono="bi-file-earmark-text"
                  etiqueta="Descriptor de cargo"
                  nombre={descriptorAutomatico}
                  alVer={verOrigen(visorDescriptor, descriptorAutomatico)}
                  ayuda={
                    descriptor.origen === 'oferta'
                      ? 'Viene de la oferta; se guarda en la carpeta de la solicitud.'
                      : 'Asociado al cargo; se guarda en la carpeta de la solicitud.'
                  }
                />
              ) : (
                <CampoArchivo
                  id="descriptorAdjunto"
                  etiqueta="Adjuntar descriptor de cargo"
                  ayuda="Queda guardado para este cargo y no se volverá a pedir."
                  archivo={formulario.descriptorAdjunto}
                  alSeleccionar={seleccionarArchivo('descriptorAdjunto')}
                  alQuitar={() => quitarAdjunto('descriptorAdjunto')}
                  alVer={adjuntos.descriptorAdjunto ? verAdjunto(adjuntos.descriptorAdjunto) : null}
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
        </SeccionFormulario>
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
      {documentoAbierto ? (
        <VentanaDocumento
          archivo={documentoAbierto.archivo}
          api={documentoAbierto.api}
          alCerrar={() => setDocumentoAbierto(null)}
        />
      ) : null}
    </form>
  );
}
