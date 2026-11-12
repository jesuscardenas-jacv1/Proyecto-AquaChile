import { enlaceReunionValido } from '../../dominio/planner';

/**
 * Botón "Unirse a la reunión" de una entrevista online (Google Meet o Teams).
 * Solo se muestra con un enlace https:// válido de Meet o Teams. Con `soloLectura`
 * (jefatura) se informa la modalidad, sin el enlace: la entrevista es confidencial.
 */
export default function BotonReunion({ enlace, modalidad, soloLectura = false, className = '' }) {
  const url = enlaceReunionValido(enlace);
  if (!url) return null;
  const servicio = modalidad || (url.includes('meet.google.com') ? 'Google Meet' : 'Teams');

  if (soloLectura) {
    return (
      <span className={`small text-secondary ${className}`.trim()}>
        <i className="bi bi-camera-video me-1" aria-hidden="true" />
        Reunión online por {servicio}
      </span>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`btn btn-sm btn-success d-inline-flex align-items-center gap-1 ${className}`.trim()}
      title={`Abrir la reunión de ${servicio} en otra pestaña`}
    >
      <i className="bi bi-camera-video" aria-hidden="true" />
      Unirse a la reunión
      <span className="visually-hidden"> de {servicio} (se abre en otra pestaña)</span>
    </a>
  );
}
