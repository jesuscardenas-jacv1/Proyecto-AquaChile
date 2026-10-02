/**
 * Tarjeta de indicador del dashboard (Bootstrap card + grilla responsive).
 * Si recibe `alSeleccionar`, la tarjeta completa es un botón que abre su detalle en una ventana emergente.
 */
export default function TarjetaIndicador({
  titulo,
  valor,
  descripcion,
  icono = 'bi-clipboard-data',
  variante = 'primary',
  enlace,
  alNavegar,
  alSeleccionar,
  seleccionada = false,
  controla,
}) {
  const clasesTarjeta = `card border-0 shadow-sm h-100 border-start border-4 border-${variante}`;
  const contenido = (
    <span className="card-body d-flex align-items-center gap-3">
      <span className={`rounded-circle bg-${variante} bg-opacity-10 text-${variante} p-3`}>
        <i className={`bi ${icono} fs-4`} aria-hidden="true" />
      </span>
      <span className="flex-grow-1">
        <span className="d-block text-secondary small mb-1">{titulo}</span>
        <span className="d-block h4 mb-0 fw-semibold">{valor}</span>
        {descripcion ? <small className="text-secondary">{descripcion}</small> : null}
      </span>
      {alSeleccionar ? (
        <i className="bi bi-box-arrow-up-right text-secondary" aria-hidden="true" />
      ) : null}
    </span>
  );

  return (
    <div className="col-12 col-sm-6 col-xl-3">
      {alSeleccionar ? (
        <button
          type="button"
          className={`${clasesTarjeta} tarjeta-indicador text-start w-100 ${
            seleccionada ? 'tarjeta-indicador-activa' : ''
          }`.trim()}
          aria-haspopup="dialog"
          aria-expanded={seleccionada}
          aria-controls={seleccionada ? controla : undefined}
          onClick={alSeleccionar}
        >
          {contenido}
        </button>
      ) : (
        <div className={clasesTarjeta}>
          {contenido}
          {enlace ? (
            <div className="card-footer bg-transparent border-0 pt-0">
              <button type="button" className="btn btn-link btn-sm p-0" onClick={alNavegar}>
                {enlace}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
