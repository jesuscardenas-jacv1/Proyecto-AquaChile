import { useEffect } from 'react';

const DURACION_MS = 6000;

/** Aviso breve en la esquina (p. ej. «Entrevista agendada»). Se cierra solo o con la ✕. */
export default function AvisoEsquina({ texto, alCerrar }) {
  useEffect(() => {
    const temporizador = setTimeout(alCerrar, DURACION_MS);
    return () => clearTimeout(temporizador);
  }, [texto, alCerrar]);

  return (
    <div className="marea-aviso-esquina marea-tema-claro" role="status">
      <i className="bi bi-check-circle-fill" aria-hidden="true" />
      <span>{texto}</span>
      <button type="button" className="btn-close" aria-label="Cerrar aviso" onClick={alCerrar} />
    </div>
  );
}
