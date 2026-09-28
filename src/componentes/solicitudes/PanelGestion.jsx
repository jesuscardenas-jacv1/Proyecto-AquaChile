import { useState } from 'react';
import { ESTADOS_SOLICITUD, PROFESIONALES } from '../../datos/constantes';

/**
 * Panel para asignar profesional responsable y cambiar el estado de la solicitud.
 */
export default function PanelGestion({
  solicitud,
  alGuardar,
  alAsignarProfesional,
  alCambiarEstado,
}) {
  const [estado, setEstado] = useState(solicitud.estado);
  const [profesional, setProfesional] = useState(solicitud.profesionalResponsable ?? '');

  const guardar = (evento) => {
    evento.preventDefault();
    alGuardar({
      estado,
      profesionalResponsable: profesional,
      observaciones: solicitud.observaciones,
    });
  };

  return (
    <section className="card border-0 shadow-sm">
      <div className="card-header bg-white">
        <h2 className="h6 mb-0">Gestión de la solicitud</h2>
      </div>
      <div className="card-body">
        <form onSubmit={guardar}>
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label" htmlFor="estado-solicitud">
                Estado
              </label>
              <select
                id="estado-solicitud"
                className="form-select"
                value={estado}
                onChange={(evento) => {
                  setEstado(evento.target.value);
                  alCambiarEstado(evento.target.value);
                }}
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
                value={profesional}
                onChange={(evento) => {
                  setProfesional(evento.target.value);
                  alAsignarProfesional(evento.target.value);
                }}
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
          <button type="submit" className="btn btn-primary btn-sm mt-3">
            Guardar cambios
          </button>
        </form>
      </div>
    </section>
  );
}
