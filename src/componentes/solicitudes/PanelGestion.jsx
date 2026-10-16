import { ESTADOS_SOLICITUD, PROFESIONALES } from '../../datos/constantes';

/**
 * Panel para asignar profesional responsable y cambiar el estado de la solicitud.
 * Los valores se leen siempre de la solicitud y cada cambio se guarda al momento,
 * así el panel refleja los cambios automáticos (p. ej. al registrar una evaluación).
 *
 * "Finalizada" solo se puede elegir si la solicitud ya tiene una evaluación con dictamen
 * (`puedeFinalizar`); la misma regla la aplica la API.
 */
export default function PanelGestion({
  solicitud,
  alAsignarProfesional,
  alCambiarEstado,
  puedeFinalizar = true,
}) {
  const finalizacionBloqueada = !puedeFinalizar && solicitud.estado !== 'Finalizada';

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
              onChange={(evento) => alCambiarEstado(evento.target.value)}
              aria-describedby={finalizacionBloqueada ? 'ayuda-estado-solicitud' : undefined}
            >
              {ESTADOS_SOLICITUD.map((item) => (
                <option
                  key={item}
                  value={item}
                  disabled={item === 'Finalizada' && finalizacionBloqueada}
                >
                  {item}
                </option>
              ))}
            </select>
            {finalizacionBloqueada ? (
              <p id="ayuda-estado-solicitud" className="form-text mb-0">
                Se finaliza automáticamente al registrar la evaluación.
              </p>
            ) : null}
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="profesional-responsable">
              Profesional responsable
            </label>
            <select
              id="profesional-responsable"
              className="form-select"
              value={solicitud.profesionalResponsable ?? ''}
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
        <p className="form-text mb-0 mt-3">Los cambios se guardan automáticamente.</p>
      </div>
    </section>
  );
}
