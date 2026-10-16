import { Link } from 'react-router-dom';
import EtiquetaEstado from '../comunes/EtiquetaEstado';
import { formatearFecha } from '../../dominio/formateo';
import { fechaInformeDe } from '../../dominio/planner';
import { iniciales } from './TarjetaPlanner';

const BORDE_RESULTADO = {
  Recomendado: 'border-success',
  'Recomendado con observaciones': 'border-warning',
  'No recomendado': 'border-danger',
};

/**
 * Tarjeta de un informe enviado para la grilla de la pantalla "Informes enviados".
 * El borde izquierdo usa el color del resultado para ubicar los dictámenes de un vistazo.
 */
export default function TarjetaInforme({ solicitud, candidato, evaluacion }) {
  const nombre = candidato?.nombre ?? 'Candidato eliminado';
  const solicitante = solicitud.profesionalResponsable || 'Sin reclutador/a';
  const resultado = evaluacion?.resultado;
  const dias = evaluacion?.diasRespuesta;

  return (
    <article
      className={`card border-0 border-start border-4 shadow-sm h-100 planner-tarjeta ${
        BORDE_RESULTADO[resultado] ?? 'border-secondary'
      }`}
      aria-label={`${nombre}, ${solicitud.cargo}`}
    >
      <div className="card-body p-3 d-flex flex-column gap-2">
        <div className="d-flex justify-content-between align-items-start gap-2">
          <h3 className="h6 mb-0">
            <Link to={`/solicitudes/${solicitud.id}`} className="text-decoration-none planner-tarjeta-nombre">
              {nombre}
            </Link>
          </h3>
          <span className="text-secondary small text-nowrap">#{solicitud.id}</span>
        </div>

        <p className="small text-secondary mb-0">
          {solicitud.cargo} · {solicitud.familiaCargo}
          {solicitud.ubicacion ? (
            <>
              <br />
              <i className="bi bi-geo-alt me-1" aria-hidden="true" />
              {solicitud.ubicacion}
            </>
          ) : null}
        </p>

        {resultado ? (
          <div>
            <EtiquetaEstado valor={resultado} contexto="resultado" />
          </div>
        ) : null}

        <dl className="row small mb-0 mt-auto g-0">
          <dt className="col-6 text-secondary fw-normal">Informe enviado</dt>
          <dd className="col-6 mb-0 text-end">{formatearFecha(fechaInformeDe(solicitud, evaluacion))}</dd>
          {Number.isFinite(dias) ? (
            <>
              <dt className="col-6 text-secondary fw-normal">Respuesta</dt>
              <dd className="col-6 mb-0 text-end">{dias} días</dd>
            </>
          ) : null}
        </dl>
      </div>

      <div className="card-footer bg-transparent d-flex align-items-center gap-2 py-2 px-3">
        <span className="d-flex align-items-center gap-2 me-auto small text-secondary" title={`Solicitado por ${solicitante}`}>
          <span className="planner-avatar" aria-hidden="true">
            {iniciales(solicitante)}
          </span>
          <span className="text-truncate planner-solicitante">{solicitante}</span>
        </span>
        <Link
          to={`/solicitudes/${solicitud.id}/informe`}
          className="btn btn-sm btn-outline-primary"
          aria-label={`Ver informe oficial de ${nombre}`}
          title="Ver informe oficial"
        >
          <i className="bi bi-printer" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
