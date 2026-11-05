import { useEffect, useRef } from 'react';

/**
 * Aviso fijo en la esquina inferior derecha, visible aunque la página esté desplazada.
 * Se cierra solo tras `duracion` ms (si se indica) o con el botón de cerrar.
 */
export default function AvisoEsquina({ mensaje, icono = 'bi-check-circle', duracion = 4000, alCerrar }) {
  const cerrarRef = useRef(alCerrar);
  cerrarRef.current = alCerrar;

  useEffect(() => {
    if (!duracion) return undefined;
    const temporizador = setTimeout(() => cerrarRef.current?.(), duracion);
    return () => clearTimeout(temporizador);
  }, [mensaje, duracion]);

  return (
    <div className="aviso-tiempo-real" role="status" aria-live="polite">
      <i className={`bi ${icono}`} aria-hidden="true" />
      <span className="flex-grow-1">{mensaje}</span>
      <button type="button" className="btn-close btn-close-white" aria-label="Cerrar aviso" onClick={alCerrar} />
    </div>
  );
}
