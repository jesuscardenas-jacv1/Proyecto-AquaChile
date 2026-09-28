/**
 * Estado vacío reutilizable para listados sin resultados.
 */
export default function EstadoVacio({
  titulo = 'Sin resultados',
  descripcion = 'No hay registros que coincidan con los criterios ingresados.',
  textoBoton,
  alAccion,
  icono = 'bi-inbox',
}) {
  return (
    <div className="text-center py-5">
      <i className={`bi ${icono} fs-1 text-secondary`} aria-hidden="true" />
      <h3 className="h6 mt-3">{titulo}</h3>
      <p className="text-secondary small mb-3">{descripcion}</p>
      {textoBoton ? (
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={alAccion}>
          {textoBoton}
        </button>
      ) : null}
    </div>
  );
}
