import { useState } from 'react';
import { ARCHIVOS_PERMITIDOS, CECOS, FAMILIAS_CARGO, OPCIONES_SI_NO, RECLUTADORES } from '../../datos/constantes';
import {
  UBICACIONES,
  datosDeCargo,
  nombresDeCargos,
  resolverDescriptor,
  unidadDeUbicacion,
} from '../../datos/catalogos';
import { normalizar } from '../../dominio/texto';
import { hayErrores, validarEdicionSolicitud } from '../../dominio/validaciones';
import Mensaje from '../comunes/Mensaje';

const siNo = (valor) => (valor === true ? 'Sí' : valor === false ? 'No' : '');

/** Valores del formulario a partir de la solicitud guardada. */
const desdeSolicitud = (solicitud) => ({
  reclutador: solicitud.reclutador ?? '',
  fechaSolicitud: solicitud.fechaSolicitud ?? '',
  cargo: solicitud.cargo ?? '',
  familiaCargo: solicitud.familiaCargo ?? '',
  ubicacion: solicitud.ubicacion ?? '',
  ceco: solicitud.ceco ?? '',
  requiereReferencias: solicitud.requiereReferencias ? 'Sí' : 'No',
  referido: siNo(solicitud.referido),
  observaciones: solicitud.observaciones ?? '',
});

const clase = (base, error) => `${base} ${error ? 'is-invalid' : ''}`.trim();

/**
 * Edición de los datos de una solicitud ya creada. Lo usan el analista y la psicóloga
 * para corregir errores o cuando el candidato cambia de cargo. El cargo del catálogo
 * completa la familia y la ubicación completa la unidad, igual que al crearla. Si cambia
 * el cargo también cambia el descriptor: el nuevo se resuelve solo y, si el cargo no tiene
 * uno, el analista debe adjuntarlo (la psicóloga no gestiona descriptores: queda pendiente).
 */
export default function FormularioEdicionSolicitud({
  solicitud,
  origenCandidato,
  cargosGuardados = [],
  puedeSubirDescriptor = false,
  alGuardar,
  alCancelar,
}) {
  const [formulario, setFormulario] = useState(() => desdeSolicitud(solicitud));
  const [archivoDescriptor, setArchivoDescriptor] = useState(null);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const esExterno = origenCandidato === 'Externo';

  const actualizar = (cambios) => {
    setFormulario((actual) => ({ ...actual, ...cambios }));
    setErrores((actual) => {
      const siguientes = { ...actual };
      Object.keys(cambios).forEach((campo) => delete siguientes[campo]);
      return siguientes;
    });
  };

  const cambiarCampo = (evento) => actualizar({ [evento.target.name]: evento.target.value });

  const cambiarCargo = (evento) => {
    const cargo = evento.target.value;
    const encontrado = datosDeCargo(cargo, cargosGuardados);
    actualizar(encontrado?.familiaCargo ? { cargo, familiaCargo: encontrado.familiaCargo } : { cargo });
  };

  const cambioCargo = normalizar(formulario.cargo.trim()) !== normalizar(solicitud.cargo ?? '');
  const descriptorNuevo = cambioCargo ? resolverDescriptor({ cargo: formulario.cargo, cargosGuardados }).nombre : '';
  const faltaDescriptor = cambioCargo && Boolean(formulario.cargo.trim()) && !descriptorNuevo;

  const elegirDescriptor = (evento) => {
    const archivo = evento.target.files?.[0] ?? null;
    if (archivo && archivo.size > ARCHIVOS_PERMITIDOS.tamanoMaximoMb * 1024 * 1024) {
      evento.target.value = '';
      setArchivoDescriptor(null);
      setErrores((actual) => ({
        ...actual,
        descriptorAdjunto: `El archivo supera el límite de ${ARCHIVOS_PERMITIDOS.tamanoMaximoMb} MB.`,
      }));
      return;
    }
    setArchivoDescriptor(archivo);
    setErrores(({ descriptorAdjunto: _quitado, ...resto }) => resto);
  };

  const manejarEnvio = async (evento) => {
    evento.preventDefault();
    const nuevosErrores = validarEdicionSolicitud(
      { ...formulario, descriptorAdjunto: archivoDescriptor?.name },
      { descriptorRequerido: faltaDescriptor && puedeSubirDescriptor },
    );
    setErrores(nuevosErrores);
    if (hayErrores(nuevosErrores)) return;

    const ubicacion = formulario.ubicacion.trim();
    setGuardando(true);
    try {
      await alGuardar({
        reclutador: formulario.reclutador,
        fechaSolicitud: formulario.fechaSolicitud,
        cargo: formulario.cargo.trim(),
        familiaCargo: formulario.familiaCargo,
        ubicacion,
        unidad: unidadDeUbicacion(ubicacion) || solicitud.unidad || '',
        ceco: formulario.ceco.trim().toUpperCase(),
        requiereReferencias: formulario.requiereReferencias === 'Sí',
        referido: esExterno && formulario.referido ? formulario.referido === 'Sí' : null,
        observaciones: formulario.observaciones.trim(),
        ...(cambioCargo ? { descriptorCargo: descriptorNuevo || archivoDescriptor?.name || '' } : {}),
      }, faltaDescriptor ? archivoDescriptor : null);
    } finally {
      setGuardando(false);
    }
  };

  const unidad = unidadDeUbicacion(formulario.ubicacion);

  return (
    <form onSubmit={manejarEnvio} noValidate aria-label="Editar datos de la solicitud">
      {hayErrores(errores) ? (
        <Mensaje tipo="danger" titulo="Revisa los datos de la solicitud">
          Hay campos obligatorios o con formato inválido.
        </Mensaje>
      ) : null}

      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="edicion-reclutador">
            Reclutador/a *
          </label>
          <select
            id="edicion-reclutador"
            name="reclutador"
            className={clase('form-select', errores.reclutador)}
            value={formulario.reclutador}
            onChange={cambiarCampo}
          >
            <option value="">Seleccione</option>
            {RECLUTADORES.map((reclutador) => (
              <option key={reclutador}>{reclutador}</option>
            ))}
          </select>
          {errores.reclutador ? <div className="invalid-feedback">{errores.reclutador}</div> : null}
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="edicion-fecha">
            Fecha de solicitud *
          </label>
          <input
            id="edicion-fecha"
            name="fechaSolicitud"
            type="date"
            className={clase('form-control', errores.fechaSolicitud)}
            value={formulario.fechaSolicitud}
            onChange={cambiarCampo}
          />
          {errores.fechaSolicitud ? <div className="invalid-feedback">{errores.fechaSolicitud}</div> : null}
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="edicion-cargo">
            Nombre del cargo *
          </label>
          <input
            id="edicion-cargo"
            name="cargo"
            type="text"
            list="edicion-cargos"
            autoComplete="off"
            className={clase('form-control', errores.cargo)}
            value={formulario.cargo}
            onChange={cambiarCargo}
          />
          <datalist id="edicion-cargos">
            {nombresDeCargos(cargosGuardados).map((nombre) => (
              <option key={nombre} value={nombre} />
            ))}
          </datalist>
          {errores.cargo ? <div className="invalid-feedback">{errores.cargo}</div> : null}
          {descriptorNuevo ? (
            <div className="form-text">
              <i className="bi bi-file-earmark-text me-1" aria-hidden="true" />
              El descriptor pasará a ser {descriptorNuevo}.
            </div>
          ) : null}
          {faltaDescriptor && !puedeSubirDescriptor ? (
            <div className="form-text text-warning-emphasis">
              <i className="bi bi-exclamation-triangle me-1" aria-hidden="true" />
              Este cargo no tiene descriptor: quedará pendiente hasta que lo suba el analista de reclutamiento.
            </div>
          ) : null}
          {faltaDescriptor && puedeSubirDescriptor ? (
            <div className="mt-2">
              <label className="form-label small" htmlFor="edicion-descriptor">
                Adjuntar descriptor de cargo *
              </label>
              <input
                id="edicion-descriptor"
                type="file"
                accept={ARCHIVOS_PERMITIDOS.extensiones}
                className={clase('form-control form-control-sm', errores.descriptorAdjunto)}
                onChange={elegirDescriptor}
              />
              {errores.descriptorAdjunto ? <div className="invalid-feedback">{errores.descriptorAdjunto}</div> : null}
              <div className="form-text">Queda guardado para este cargo y no se volverá a pedir.</div>
            </div>
          ) : null}
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="edicion-familia">
            Familia del cargo *
          </label>
          <select
            id="edicion-familia"
            name="familiaCargo"
            className={clase('form-select', errores.familiaCargo)}
            value={formulario.familiaCargo}
            onChange={cambiarCampo}
          >
            <option value="">Seleccione una familia</option>
            {FAMILIAS_CARGO.map((familia) => (
              <option key={familia}>{familia}</option>
            ))}
          </select>
          {errores.familiaCargo ? <div className="invalid-feedback">{errores.familiaCargo}</div> : null}
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="edicion-ubicacion">
            Ubicación del cargo *
          </label>
          <input
            id="edicion-ubicacion"
            name="ubicacion"
            type="text"
            list="edicion-ubicaciones"
            autoComplete="off"
            className={clase('form-control', errores.ubicacion)}
            value={formulario.ubicacion}
            onChange={cambiarCampo}
          />
          <datalist id="edicion-ubicaciones">
            {UBICACIONES.map((ubicacion) => (
              <option key={ubicacion.nombre} value={ubicacion.nombre} />
            ))}
          </datalist>
          {errores.ubicacion ? <div className="invalid-feedback">{errores.ubicacion}</div> : null}
          {unidad ? <div className="form-text">Unidad: {unidad}</div> : null}
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="edicion-ceco">
            CECO
          </label>
          <select
            id="edicion-ceco"
            name="ceco"
            className={clase('form-select', errores.ceco)}
            value={formulario.ceco}
            onChange={cambiarCampo}
          >
            <option value="">Sin CECO</option>
            {/* Una solicitud antigua puede tener un CECO que no está en la lista: se conserva. */}
            {solicitud.ceco && !CECOS.some(({ codigo }) => codigo === solicitud.ceco) ? (
              <option value={solicitud.ceco}>{solicitud.ceco}</option>
            ) : null}
            {CECOS.map(({ codigo, nombre }) => (
              <option key={codigo} value={codigo}>
                {codigo} · {nombre}
              </option>
            ))}
          </select>
          {errores.ceco ? <div className="invalid-feedback">{errores.ceco}</div> : null}
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label" htmlFor="edicion-referencias">
            ¿Requiere referencias?
          </label>
          <select
            id="edicion-referencias"
            name="requiereReferencias"
            className="form-select"
            value={formulario.requiereReferencias}
            onChange={cambiarCampo}
          >
            {OPCIONES_SI_NO.map((opcion) => (
              <option key={opcion}>{opcion}</option>
            ))}
          </select>
        </div>

        {esExterno ? (
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="edicion-referido">
              ¿El candidato/a es referido/a?
            </label>
            <select
              id="edicion-referido"
              name="referido"
              className="form-select"
              value={formulario.referido}
              onChange={cambiarCampo}
            >
              <option value="">Sin información</option>
              {OPCIONES_SI_NO.map((opcion) => (
                <option key={opcion}>{opcion}</option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="col-12">
          <label className="form-label" htmlFor="edicion-observaciones">
            Aspectos a indagar
          </label>
          <textarea
            id="edicion-observaciones"
            name="observaciones"
            rows={3}
            className="form-control"
            value={formulario.observaciones}
            onChange={cambiarCampo}
          />
        </div>
      </div>

      <div className="d-flex justify-content-end gap-2 mt-3">
        <button type="button" className="btn btn-outline-secondary" onClick={alCancelar} disabled={guardando}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
