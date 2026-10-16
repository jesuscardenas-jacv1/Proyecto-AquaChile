import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDatos } from '../datos/DatosContext';
import { useAuth } from '../datos/AuthContext';
import { formatearFecha } from '../dominio/formateo';
import EtiquetaEstado from '../componentes/comunes/EtiquetaEstado';
import EstadoVacio from '../componentes/comunes/EstadoVacio';
import Mensaje from '../componentes/comunes/Mensaje';
import PanelDocumentos from '../componentes/solicitudes/PanelDocumentos';

/**
 * Ficha del candidato: sus datos y, por cada solicitud de evaluación, la carpeta con
 * el CV, el descriptor de cargo y el informe psicolaboral.
 */
export default function DetalleCandidato() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { esAnalista } = useAuth();
  const { obtenerCandidato, solicitudes, obtenerEvaluacionDeSolicitud } = useDatos();

  const candidato = obtenerCandidato(id);

  if (!candidato) {
    return (
      <Mensaje tipo="warning" titulo="Candidato no encontrado">
        El candidato solicitado no existe.
        <div className="mt-2">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => navegar('/candidatos')}
          >
            Volver al listado
          </button>
        </div>
      </Mensaje>
    );
  }

  // La más reciente primero: normalmente es la que se está evaluando.
  const solicitudesCandidato = solicitudes
    .filter((solicitud) => solicitud.candidatoId === candidato.id)
    .sort((a, b) => String(b.fechaSolicitud).localeCompare(String(a.fechaSolicitud)) || b.id - a.id);

  const datos = [
    ['Correo', candidato.correo],
    ['Teléfono', candidato.telefono],
    ['Cargo', candidato.cargo],
    ['Familia de cargo', candidato.familiaCargo],
    ['Origen', candidato.origen],
  ];

  return (
    <div className="d-flex flex-column gap-3">
      <nav aria-label="miga de pan">
        <button
          type="button"
          className="btn btn-link btn-sm px-0"
          onClick={() => navegar('/candidatos')}
        >
          <i className="bi bi-arrow-left me-1" aria-hidden="true" />
          Volver a candidatos
        </button>
      </nav>

      <header className="d-flex flex-column flex-md-row justify-content-between gap-2">
        <div>
          <h1 className="h4 mb-1">{candidato.nombre}</h1>
          <p className="text-secondary mb-0">
            {candidato.cargo} · {candidato.familiaCargo}
          </p>
        </div>
        {esAnalista ? (
          <Link
            to={`/candidatos/${candidato.id}/editar`}
            className="btn btn-outline-primary btn-sm align-self-start"
          >
            <i className="bi bi-pencil me-1" aria-hidden="true" />
            Editar
          </Link>
        ) : null}
      </header>

      <section className="card border-0 shadow-sm">
        <div className="card-header bg-white">
          <h2 className="h6 mb-0">Datos del candidato</h2>
        </div>
        <div className="card-body">
          <dl className="row mb-0 small">
            {datos.map(([etiqueta, valor]) => (
              <div key={etiqueta} className="col-12 col-sm-6 col-lg-4 mb-2">
                <dt className="text-secondary fw-normal">{etiqueta}</dt>
                <dd className="mb-0 text-break">{valor || '—'}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <h2 className="h5 mb-0 mt-2">
        {solicitudesCandidato.length === 1
          ? 'Evaluación y documentos'
          : `Evaluaciones y documentos (${solicitudesCandidato.length})`}
      </h2>

      {solicitudesCandidato.length === 0 ? (
        <section className="card border-0 shadow-sm">
          <EstadoVacio
            titulo="Sin solicitudes de evaluación"
            descripcion="Este candidato aún no tiene una solicitud, por eso no tiene carpeta de documentos."
            icono="bi-folder2"
          />
        </section>
      ) : (
        solicitudesCandidato.map((solicitud) => {
          const evaluacion = obtenerEvaluacionDeSolicitud(solicitud.id);
          return (
            <article
              key={solicitud.id}
              className="d-flex flex-column gap-2"
              aria-label={`Solicitud #${solicitud.id}`}
            >
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <h3 className="h6 mb-0">
                    Solicitud #{solicitud.id} · {solicitud.cargo}
                  </h3>
                  <span className="small text-secondary">
                    {formatearFecha(solicitud.fechaSolicitud)}
                  </span>
                  <EtiquetaEstado valor={solicitud.estado} />
                  {evaluacion ? (
                    <EtiquetaEstado valor={evaluacion.resultado} contexto="resultado" />
                  ) : null}
                </div>
                <Link
                  to={`/solicitudes/${solicitud.id}`}
                  className="btn btn-link btn-sm px-0"
                >
                  Ver solicitud
                  <i className="bi bi-chevron-right ms-1" aria-hidden="true" />
                </Link>
              </div>
              <PanelDocumentos solicitud={solicitud} nombreCandidato={candidato.nombre} />
            </article>
          );
        })
      )}
    </div>
  );
}
