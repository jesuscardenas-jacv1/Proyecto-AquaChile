import { useState } from 'react';
import { ARCHIVOS_PERMITIDOS, FAMILIAS_CARGO } from '../../datos/constantes';
import { datosDeCargo, nombresDeCargos, resolverDescriptor } from '../../datos/catalogos';
import { apiDocumentos, documentoCargo, documentoCatalogo } from '../../servicios/apiDocumentos';
import VentanaDocumento from '../solicitudes/VentanaDocumento';
import { AREAS_OFERTA } from '../../datos/demoPostulaciones';
import { JORNADAS_OFERTA, requisitosDesdeTexto, validarOferta } from '../../dominio/ofertas';
import { hayErrores } from '../../dominio/validaciones';

const VACIA = {
  titulo: '',
  area: '',
  cargo: '',
  familiaCargo: '',
  ubicacion: '',
  region: '',
  jornada: JORNADAS_OFERTA[0],
  descripcion: '',
  requisitos: [],
  descriptorNombre: '',
};

/**
 * Formulario de una oferta de empleo. Un borrador se puede guardar solo con el título y
 * publicar cuando esté completo; una oferta ya publicada debe seguir completa, porque
 * sus cambios se ven de inmediato en el portal. El descriptor es interno y se guarda por cargo:
 * se sube una vez y lo reutilizan las demás ofertas de ese cargo. Es obligatorio para publicar.
 */
export default function FormularioOferta({
  inicial = VACIA,
  alGuardar,
  alCancelar,
  alDescargarDescriptor,
  cargosGuardados = [],
  alRedactar = null,
}) {
  const esBorrador = (inicial.estado ?? 'Borrador') === 'Borrador';
  const [campos, setCampos] = useState({
    ...VACIA,
    ...inicial,
    requisitos: (inicial.requisitos ?? []).join('\n'),
  });
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [descriptor, setDescriptor] = useState(null);
  const [documentoAbierto, setDocumentoAbierto] = useState(null);
  const [redactando, setRedactando] = useState(false);
  const [avisoIa, setAvisoIa] = useState(null);
  const resuelto = resolverDescriptor({ cargo: campos.cargo, cargosGuardados, oferta: inicial });
  const descriptorDisponible = resuelto.nombre;
  const visorDescriptor =
    resuelto.origen === 'catalogo'
      ? () => documentoCatalogo(resuelto.nombre)
      : resuelto.origen === 'cargo' && apiDocumentos.conectado()
        ? () => documentoCargo(resuelto.cargoGuardado)
        : null;
  const textoOrigen = {
    cargo: '· guardado para este cargo',
    oferta: '· subido en esta oferta',
    catalogo: '· de demostración para este cargo',
  }[resuelto.origen];

  const cambiar = (evento) => {
    const { name, value } = evento.target;
    setCampos((actual) => ({ ...actual, [name]: value }));
    setErrores((actual) => ({ ...actual, [name]: undefined }));
  };

  const cambiarCargo = (evento) => {
    const cargo = evento.target.value;
    const encontrado = datosDeCargo(cargo, cargosGuardados);
    setCampos((actual) => ({ ...actual, cargo, ...(encontrado ? { familiaCargo: encontrado.familiaCargo } : {}) }));
    setErrores((actual) => ({
      ...actual,
      cargo: undefined,
      ...(encontrado ? { familiaCargo: undefined, descriptor: undefined } : {}),
    }));
  };

  const seleccionarDescriptor = (evento) => {
    const archivo = evento.target.files?.[0] ?? null;
    if (archivo && archivo.size > ARCHIVOS_PERMITIDOS.tamanoMaximoMb * 1024 * 1024) {
      evento.target.value = '';
      setDescriptor(null);
      setErrores((actual) => ({
        ...actual,
        descriptor: `El archivo supera el límite de ${ARCHIVOS_PERMITIDOS.tamanoMaximoMb} MB.`,
      }));
      return;
    }
    setDescriptor(archivo);
    setErrores((actual) => ({ ...actual, descriptor: undefined }));
  };

  /** Pide a la IA un borrador de título, descripción y requisitos a partir del descriptor del cargo. */
  const redactarConIa = async () => {
    if (!campos.cargo.trim()) {
      setErrores((actual) => ({ ...actual, cargo: 'Indica el cargo para redactar la oferta con IA.' }));
      return;
    }
    const hayTexto = campos.descripcion.trim() || campos.requisitos.trim();
    if (hayTexto && !window.confirm('La IA reemplazará la descripción y los requisitos que escribiste. ¿Continuar?')) return;
    setAvisoIa(null);
    setRedactando(true);
    try {
      const borrador = await alRedactar({
        cargo: campos.cargo,
        familiaCargo: campos.familiaCargo,
        area: campos.area,
        ubicacion: campos.ubicacion,
        jornada: campos.jornada,
      });
      setCampos((actual) => ({
        ...actual,
        titulo: actual.titulo.trim() ? actual.titulo : borrador.titulo,
        descripcion: borrador.descripcion,
        requisitos: borrador.requisitos.join('\n'),
      }));
      setErrores((actual) => ({ ...actual, titulo: undefined, descripcion: undefined }));
      setAvisoIa({ tipo: 'success', texto: 'Borrador redactado con IA. Revísalo y ajústalo antes de publicar.' });
    } catch (excepcion) {
      setAvisoIa({ tipo: 'danger', texto: excepcion.message });
    } finally {
      setRedactando(false);
    }
  };

  const guardar = async ({ publicar }) => {
    const nuevosErrores = validarOferta(campos, { completa: publicar || !esBorrador });
    if (publicar && !descriptor && !descriptorDisponible) {
      nuevosErrores.descriptor = 'Sube el descriptor de cargo para publicar la oferta.';
    }
    if (descriptor && !campos.cargo.trim()) {
      nuevosErrores.cargo = 'Indica el cargo para guardar su descriptor.';
    }
    setErrores(nuevosErrores);
    if (hayErrores(nuevosErrores)) return;
    setGuardando(true);
    try {
      await alGuardar({ ...campos, requisitos: requisitosDesdeTexto(campos.requisitos) }, { publicar, descriptor });
    } finally {
      setGuardando(false);
    }
  };

  const clases = (base, nombre) => `${base} ${errores[nombre] ? 'is-invalid' : ''}`.trim();
  const error = (nombre) => (errores[nombre] ? <div className="invalid-feedback">{errores[nombre]}</div> : null);

  const texto = (nombre, etiqueta, columnas = 'col-12 col-md-6', ayuda = '') => (
    <div className={columnas}>
      <label className="form-label" htmlFor={`oferta-${nombre}`}>
        {etiqueta}
      </label>
      <input
        id={`oferta-${nombre}`}
        name={nombre}
        className={clases('form-control', nombre)}
        placeholder={ayuda}
        value={campos[nombre]}
        onChange={cambiar}
      />
      {error(nombre)}
    </div>
  );

  const selector = (nombre, etiqueta, opciones) => (
    <div className="col-12 col-md-4">
      <label className="form-label" htmlFor={`oferta-${nombre}`}>
        {etiqueta}
      </label>
      <select
        id={`oferta-${nombre}`}
        name={nombre}
        className={clases('form-select', nombre)}
        value={campos[nombre]}
        onChange={cambiar}
      >
        {nombre === 'jornada' ? null : <option value="">Selecciona…</option>}
        {opciones.map((opcion) => (
          <option key={opcion} value={opcion}>
            {opcion}
          </option>
        ))}
      </select>
      {error(nombre)}
    </div>
  );

  return (
    <form
      className="card border-0 shadow-sm"
      aria-label="Datos de la oferta"
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault();
        guardar({ publicar: esBorrador });
      }}
    >
      <div className="card-body row g-3">
        {texto('titulo', 'Título de la oferta *', 'col-12', 'Ej: Operario de Planta - Calbuco')}
        {selector('area', 'Área *', AREAS_OFERTA)}
        {selector('familiaCargo', 'Familia de cargo *', FAMILIAS_CARGO)}
        {selector('jornada', 'Jornada *', JORNADAS_OFERTA)}
        <div className="col-12 col-md-4">
          <label className="form-label" htmlFor="oferta-cargo">
            Cargo *
          </label>
          <input
            id="oferta-cargo"
            name="cargo"
            list="oferta-cargos"
            autoComplete="off"
            className={clases('form-control', 'cargo')}
            value={campos.cargo}
            onChange={cambiarCargo}
          />
          <datalist id="oferta-cargos">
            {nombresDeCargos(cargosGuardados).map((nombre) => (
              <option key={nombre} value={nombre} />
            ))}
          </datalist>
          {error('cargo')}
        </div>
        {texto('ubicacion', 'Ubicación *', 'col-12 col-md-4', 'Ej: Planta Calbuco')}
        {texto('region', 'Región *', 'col-12 col-md-4', 'Ej: Los Lagos')}
        {alRedactar ? (
          <div className="col-12">
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={redactarConIa} disabled={redactando}>
              {redactando ? (
                <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
              ) : (
                <i className="bi bi-stars me-1" aria-hidden="true" />
              )}
              {redactando ? 'Redactando…' : 'Redactar con IA'}
            </button>
            {avisoIa ? (
              <div
                className={`form-text ${avisoIa.tipo === 'danger' ? 'text-danger' : 'text-success'}`}
                role={avisoIa.tipo === 'danger' ? 'alert' : 'status'}
              >
                {avisoIa.texto}
              </div>
            ) : (
              <div className="form-text">Propone título, descripción y requisitos a partir del descriptor del cargo.</div>
            )}
          </div>
        ) : null}
        <div className="col-12">
          <label className="form-label" htmlFor="oferta-descripcion">
            Descripción del cargo *
          </label>
          <textarea
            id="oferta-descripcion"
            name="descripcion"
            rows={4}
            className={clases('form-control', 'descripcion')}
            value={campos.descripcion}
            onChange={cambiar}
          />
          {error('descripcion')}
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="oferta-requisitos">
            Requisitos (uno por línea)
          </label>
          <textarea
            id="oferta-requisitos"
            name="requisitos"
            rows={4}
            className="form-control"
            value={campos.requisitos}
            onChange={cambiar}
          />
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="oferta-descriptor">
            Descriptor de cargo{descriptorDisponible ? '' : ' *'}{' '}
            <small className="text-secondary fw-normal">(uso interno, no se publica)</small>
          </label>
          {descriptorDisponible ? (
            <div className="d-flex flex-wrap align-items-center gap-2 small mb-2">
              <i className="bi bi-file-earmark-text text-secondary" aria-hidden="true" />
              <span className="text-break">{resuelto.nombre}</span>
              <span className="text-secondary">{textoOrigen}</span>
              {resuelto.origen === 'oferta' && alDescargarDescriptor ? (
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={alDescargarDescriptor}>
                  <i className="bi bi-download me-1" aria-hidden="true" />
                  Descargar
                </button>
              ) : null}
              {visorDescriptor ? (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary py-0 px-2"
                  aria-label={`Ver ${resuelto.nombre}`}
                  title="Vista previa"
                  onClick={() =>
                    setDocumentoAbierto({
                      archivo: { nombre: resuelto.nombre },
                      api: visorDescriptor(),
                    })
                  }
                >
                  <i className="bi bi-eye" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          ) : null}
          <input
            id="oferta-descriptor"
            type="file"
            className={clases('form-control', 'descriptor')}
            accept={ARCHIVOS_PERMITIDOS.extensiones}
            onChange={seleccionarDescriptor}
          />
          {error('descriptor')}
          <div className="form-text">
            {descriptorDisponible
              ? 'Sube un archivo solo si quieres reemplazarlo. '
              : 'Se guarda para este cargo y no se volverá a pedir en sus próximas ofertas. '}
            1 archivo de hasta {ARCHIVOS_PERMITIDOS.tamanoMaximoMb} MB ({ARCHIVOS_PERMITIDOS.descripcion}).
          </div>
        </div>
        {esBorrador ? (
          <p className="small text-secondary mb-0">
            El borrador no se ve en el portal. Para publicar deben estar completos los campos con *.
          </p>
        ) : (
          <p className="small text-secondary mb-0">
            {inicial.estado === 'Abierta'
              ? 'Los cambios se verán de inmediato en el portal.'
              : 'Esta oferta está cerrada: no se ve en el portal hasta que la reabras.'}
          </p>
        )}
      </div>
      <div className="card-footer d-flex flex-wrap justify-content-end gap-2">
        <button type="button" className="btn btn-outline-secondary me-auto" onClick={alCancelar} disabled={guardando}>
          Cancelar
        </button>
        {esBorrador ? (
          <>
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={() => guardar({ publicar: false })}
              disabled={guardando}
            >
              Guardar borrador
            </button>
            <button type="submit" className="btn btn-primary" disabled={guardando}>
              <i className="bi bi-megaphone me-1" aria-hidden="true" />
              Publicar oferta
            </button>
          </>
        ) : (
          <button type="submit" className="btn btn-primary" disabled={guardando}>
            Guardar cambios
          </button>
        )}
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
