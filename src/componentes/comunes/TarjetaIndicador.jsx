/**
 * Tarjeta de indicador del dashboard (Bootstrap card + grilla responsive).
 */
export default function TarjetaIndicador({
  titulo,
  valor,
  descripcion,
  icono = 'bi-clipboard-data',
  variante = 'primary',
  enlace,
  alNavegar,
}) {
  return (
    <div className="col-12 col-sm-6 col-xl-3">
      <div className={`card border-0 shadow-sm h-100 border-start border-4 border-${variante}`}>
        <div className="card-body d-flex align-items-center gap-3">
          <span className={`rounded-circle bg-${variante} bg-opacity-10 text-${variante} p-3`}>
            <i className={`bi ${icono} fs-4`} aria-hidden="true" />
          </span>
          <div>
            <p className="text-secondary small mb-1">{titulo}</p>
            <p className="h4 mb-0 fw-semibold">{valor}</p>
            {descripcion ? <small className="text-secondary">{descripcion}</small> : null}
          </div>
        </div>
        {enlace ? (
          <div className="card-footer bg-transparent border-0 pt-0">
            <button type="button" className="btn btn-link btn-sm p-0" onClick={alNavegar}>
              {enlace}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
