import { useState } from 'react';
import { FAMILIAS_CARGO } from '../../datos/constantes';
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
};

/**
 * Formulario de una oferta de empleo. Un borrador se puede guardar solo con el título y
 * publicar cuando esté completo; una oferta ya publicada debe seguir completa, porque
 * sus cambios se ven de inmediato en el portal.
 */
export default function FormularioOferta({ inicial = VACIA, alGuardar, alCancelar }) {
  const esBorrador = (inicial.estado ?? 'Borrador') === 'Borrador';
  const [campos, setCampos] = useState({
    ...VACIA,
    ...inicial,
    requisitos: (inicial.requisitos ?? []).join('\n'),
  });
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const cambiar = (evento) => {
    const { name, value } = evento.target;
    setCampos((actual) => ({ ...actual, [name]: value }));
    setErrores((actual) => ({ ...actual, [name]: undefined }));
  };

  const guardar = async ({ publicar }) => {
    const nuevosErrores = validarOferta(campos, { completa: publicar || !esBorrador });
    setErrores(nuevosErrores);
    if (hayErrores(nuevosErrores)) return;
    setGuardando(true);
    try {
      await alGuardar({ ...campos, requisitos: requisitosDesdeTexto(campos.requisitos) }, { publicar });
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
        {texto('cargo', 'Cargo *', 'col-12 col-md-4')}
        {texto('ubicacion', 'Ubicación *', 'col-12 col-md-4', 'Ej: Planta Calbuco')}
        {texto('region', 'Región *', 'col-12 col-md-4', 'Ej: Los Lagos')}
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
    </form>
  );
}
