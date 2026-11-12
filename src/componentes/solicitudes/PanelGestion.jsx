import { Link } from 'react-router-dom';
import { EVALUADORES } from '../../datos/constantes';
import { etapaDeSolicitud, obtenerEtapa, textoEntrevista } from '../../dominio/planner';
import EtiquetaEstado from '../comunes/EtiquetaEstado';
import BotonReunion from '../comunes/BotonReunion';

/** Texto de la etapa actual; la entrevista solo se menciona mientras está por realizarse. */
function textoEtapa(solicitud) {
  const etapa = etapaDeSolicitud(solicitud);
  if (etapa === 'cerrada') return 'Cerrada sin informe';
  const titulo = obtenerEtapa(etapa).titulo;
  return etapa === 'agendada' ? `${titulo} · ${textoEntrevista(solicitud)}` : titulo;
}

/**
 * Seguimiento de la solicitud: muestra su estado y su etapa, sin permitir cambiarlos.
 * El avance se gestiona únicamente en el Planner de la psicóloga, para que estado y etapa
 * no se contradigan. Aquí solo se asigna la psicóloga responsable (perfil analista);
 * sin `puedeAsignar` se muestra como texto.
 */
export default function PanelGestion({
  solicitud,
  alAsignarProfesional,
  soloLectura = false,
  puedeAsignar = true,
  puedeGestionar = false,
}) {
  return (
    <section className="card border-0 shadow-sm">
      <div className="card-header bg-white">
        <h2 className="h6 mb-0">Seguimiento de la solicitud</h2>
      </div>
      <div className="card-body">
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <span className="form-label d-block">Estado</span>
            <EtiquetaEstado valor={solicitud.estado} />
            <span className="form-label d-block mt-3">Etapa en el Planner</span>
            <p className="mb-0">{textoEtapa(solicitud)}</p>
            {etapaDeSolicitud(solicitud) === 'agendada' && solicitud.enlaceReunion ? (
              <BotonReunion
                enlace={solicitud.enlaceReunion}
                modalidad={solicitud.modalidadEntrevista}
                soloLectura={soloLectura}
                className="mt-2"
              />
            ) : null}
          </div>

          <div className="col-12 col-md-6">
            {puedeAsignar ? (
              <>
                <label className="form-label" htmlFor="profesional-responsable">
                  Psicóloga responsable
                </label>
                <select
                  id="profesional-responsable"
                  className="form-select"
                  value={solicitud.profesionalResponsable ?? ''}
                  disabled={soloLectura}
                  onChange={(evento) => alAsignarProfesional(evento.target.value)}
                >
                  <option value="">Sin asignar</option>
                  {EVALUADORES.map((nombre) => (
                    <option key={nombre} value={nombre}>
                      {nombre}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <span className="form-label d-block">Psicóloga responsable</span>
                <p className="mb-0 py-2">{solicitud.profesionalResponsable || 'Sin asignar'}</p>
                <div className="form-text mt-0">La asigna el analista de reclutamiento.</div>
              </>
            )}
          </div>
        </div>
        {puedeGestionar ? (
          <Link to="/planner" className="btn btn-sm btn-outline-primary mt-3">
            <i className="bi bi-calendar3 me-1" aria-hidden="true" />
            Gestionar en el Planner
          </Link>
        ) : (
          <p className="form-text mb-0 mt-3">El avance de la solicitud lo gestiona la psicóloga en su Planner.</p>
        )}
      </div>
    </section>
  );
}
