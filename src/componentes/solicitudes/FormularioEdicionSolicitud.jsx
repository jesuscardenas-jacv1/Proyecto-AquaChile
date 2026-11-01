import { useState } from 'react';
import { FAMILIAS_CARGO, OPCIONES_SI_NO, RECLUTADORES } from '../../datos/constantes';
import { CARGOS, UBICACIONES, buscarCargo, unidadDeUbicacion } from '../../datos/catalogos';
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
 * completa la familia y la ubicación completa la unidad, igual que al crearla.
 */
export default function FormularioEdicionSolicitud({ solicitud, origenCandidato, alGuardar, alCancelar }) {
  const [formulario, setFormulario] = useState(() => desdeSolicitud(solicitud));
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
    const encontrado = buscarCargo(cargo);
    actualizar(encontrado ? { cargo, familiaCargo: encontrado.familiaCargo } : { cargo });
  };

  const manejarEnvio = async (evento) => {
    evento.preventDefault();
    const nuevosErrores = validarEdicionSolicitud(formulario);
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
      });
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
            {CARGOS.map((cargo) => (
              <option key={cargo.nombre} value={cargo.nombre} />
            ))}
          </datalist>
          {errores.cargo ? <div className="invalid-feedback">{errores.cargo}</div> : null}
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
          <input
            id="edicion-ceco"
            name="ceco"
            type="text"
            placeholder="A170010311"
            className={clase('form-control', errores.ceco)}
            value={formulario.ceco}
            onChange={cambiarCampo}
          />
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
