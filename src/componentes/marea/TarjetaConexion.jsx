/**
 * Tarjeta de una función de Marea en la columna "Conectada a": ícono con punto verde, nombre y detalle.
 * Sin `conexion` muestra la tarjeta punteada "Nuevo módulo" (en desarrollo, no se puede elegir).
 */
export default function TarjetaConexion({ conexion, activa = false, alElegir }) {
  if (!conexion) {
    return (
      <div className="marea-conexion marea-pendiente">
        <span className="marea-icono" aria-hidden="true">
          <i className="bi bi-plus-lg" />
        </span>
        <span>
          <b>Nuevo módulo</b>
          <small>En desarrollo por el equipo</small>
        </span>
      </div>
    );
  }
  return (
    <button type="button" className="marea-conexion" aria-pressed={activa} onClick={() => alElegir(conexion)}>
      <span className="marea-icono" aria-hidden="true">
        <i className={`bi ${conexion.icono}`} />
      </span>
      <span>
        <b>{conexion.nombre}</b>
        <small>{conexion.detalle}</small>
      </span>
      <i className="bi bi-chevron-right marea-flecha" aria-hidden="true" />
    </button>
  );
}
