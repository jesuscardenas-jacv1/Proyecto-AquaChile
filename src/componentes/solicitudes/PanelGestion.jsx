import { ESTADOS_SOLICITUD, PROFESIONALES } from '../../datos/constantes';

/**
 * Panel para asignar profesional responsable y cambiar el estado de la solicitud.
 * Los valores se leen siempre de la solicitud y cada cambio se guarda al momento,
 * así el panel refleja los cambios automáticos (p. ej. al registrar una evaluación).
 * Con `soloLectura` (perfil jefatura) muestra los valores sin permitir cambios.
 */
export default function PanelGestion({
  solicitud,
  alAsignarProfesional,
  alCambiarEstado,
  soloLectura = false,
}) {
  return (
    <section className="card border-0 shadow-sm">
      <div className="card-header bg-white">
        <h2 className="h6 mb-0">Gestión de la solicitud</h2>
      </div>
      <div className="card-body">
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="estado-solicitud">
              Estado
            </label>
            <select
              id="estado-solicitud"
              className="form-select"
              value={solicitud.estado}
              disabled={soloLectura}
              onChange={(evento) => alCambiarEstado(evento.target.value)}
            >
              {ESTADOS_SOLICITUD.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="profesional-responsable">
              Profesional responsable
            </label>
            <select
              id="profesional-responsable"
              className="form-select"
              value={solicitud.profesionalResponsable ?? ''}
              disabled={soloLectura}
              onChange={(evento) => alAsignarProfesional(evento.target.value)}
            >
              <option value="">Sin asignar</option>
              {PROFESIONALES.map((nombre) => (
                <option key={nombre} value={nombre}>
                  {nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="form-text mb-0 mt-3">
          {soloLectura
            ? 'Su perfil solo puede consultar el estado y el responsable.'
            : 'Los cambios se guardan automáticamente.'}
        </p>
      </div>
    </section>
  );
}
