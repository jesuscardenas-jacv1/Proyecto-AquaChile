const ICONOS = {
  success: 'bi-check-circle',
  danger: 'bi-exclamation-triangle',
  warning: 'bi-exclamation-circle',
  info: 'bi-info-circle',
};

/**
 * Mensaje de retroalimentacion (alerta de Bootstrap) que puede cerrarse.
 */
export default function Mensaje({ tipo = 'info', titulo, children, alCerrar }) {
  return (
    <div
      className={`alert alert-${tipo} alert-dismissible d-flex align-items-start gap-2`}
      role="alert"
    >
      <span className={`bi ${ICONOS[tipo] ?? ICONOS.info}`} aria-hidden="true" />
      <div className="flex-grow-1">
        {titulo ? <strong className="d-block">{titulo}</strong> : null}
        <span>{children}</span>
      </div>
      {alCerrar ? (
        <button
          type="button"
          className="btn-close"
          aria-label="Cerrar mensaje"
          onClick={alCerrar}
        />
      ) : null}
    </div>
  );
}
