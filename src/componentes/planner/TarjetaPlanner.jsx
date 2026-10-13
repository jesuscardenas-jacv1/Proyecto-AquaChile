import { Link } from 'react-router-dom';
import EtiquetaEstado from '../comunes/EtiquetaEstado';
import { formatearFecha } from '../../dominio/formateo';
import { accionesDisponibles, diasEntre, textoEntrevista } from '../../dominio/planner';

/** Iniciales para el avatar del analista solicitante ("Javiera Soto" → "JS"). */
export function iniciales(nombre = '') {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join('');
}

const textoDias = (dias) => {
  if (dias === null || dias < 0) return '';
  if (dias === 0) return 'hoy';
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
};

/**
 * Aviso bajo el texto de la entrevista según la etapa:
 * cuánto lleva esperando una solicitud recibida, si la entrevista es hoy o ya pasó, etc.
 */
function avisoTarjeta(etapa, solicitud, hoy) {
  if (etapa === 'recibida') {
    const dias = diasEntre(solicitud.fechaSolicitud, hoy);
    return { texto: `Recibida ${textoDias(dias)}`.trim(), alerta: dias !== null && dias >= 3 };
  }
  if (etapa === 'agendada' && solicitud.fechaEntrevista) {
    if (solicitud.fechaEntrevista === hoy) {
      return { texto: 'Entrevista programada para hoy', alerta: false, hoy: true };
    }
    if (solicitud.fechaEntrevista < hoy) {
      return { texto: 'La fecha ya pasó: marcar como realizada o reagendar', alerta: true };
    }
  }
  if (etapa === 'realizada') return { texto: 'Pendiente: registrar evaluación e informe', alerta: false };
  return null;
}

/**
 * Tarjeta de una solicitud en el Planner. Muestra candidato, cargo, la entrevista
 * ("Entrevista coordinada para 9/09 a las 12:30") y el analista que la solicitó.
 * Las acciones solo aparecen si `editable` es verdadero (perfil evaluador).
 */
export default function TarjetaPlanner({
  solicitud,
  candidato,
  evaluacion,
  etapa,
  hoy,
  editable,
  alAgendar,
  alReagendar,
  alMarcarRealizada,
  alRegistrarInforme,
  alRetroceder,
}) {
  const acciones = accionesDisponibles(etapa);
  const aviso = avisoTarjeta(etapa, solicitud, hoy);
  const nombre = candidato?.nombre ?? 'Candidato eliminado';
  const solicitante = solicitud.profesionalResponsable || 'Sin reclutador/a';

  return (
    <article className="card border-0 shadow-sm planner-tarjeta" aria-label={`${nombre}, ${solicitud.cargo}`}>
      <div className="card-body p-3">
        <div className="d-flex justify-content-between align-items-start gap-2">
          <Link to={`/solicitudes/${solicitud.id}`} className="fw-semibold text-decoration-none planner-tarjeta-nombre">
            {nombre}
          </Link>
          <span className="text-secondary small text-nowrap">#{solicitud.id}</span>
        </div>
        <p className="small text-secondary mb-2">
          {solicitud.cargo} · {solicitud.familiaCargo}
        </p>

        {etapa === 'informe' ? (
          <div className="d-flex flex-wrap align-items-center gap-2 small">
            <span>
              <i className="bi bi-send-check me-1 text-success" aria-hidden="true" />
              Informe enviado el{' '}
              {formatearFecha(evaluacion?.fechaInforme || evaluacion?.fechaEvaluacion)}
            </span>
            {evaluacion?.resultado ? (
              <EtiquetaEstado valor={evaluacion.resultado} contexto="resultado" />
            ) : null}
          </div>
        ) : (
          <p className="small mb-1">
            <i className="bi bi-calendar-event me-1 text-primary" aria-hidden="true" />
            {textoEntrevista(solicitud)}
            {solicitud.fechaEntrevista && solicitud.modalidadEntrevista ? (
              <span className="badge rounded-pill bg-primary-subtle text-primary-emphasis ms-2">
                {solicitud.modalidadEntrevista}
              </span>
            ) : null}
          </p>
        )}

        {aviso?.texto ? (
          <p
            className={`small mb-0 ${aviso.alerta ? 'text-acento fw-semibold' : 'text-secondary'}`}
          >
            {aviso.hoy ? <span className="badge bg-acento me-1">Hoy</span> : null}
            {aviso.texto}
          </p>
        ) : null}
      </div>

      <div className="card-footer bg-transparent d-flex flex-wrap align-items-center gap-2 py-2 px-3">
        <span className="d-flex align-items-center gap-2 me-auto small text-secondary" title={`Solicitado por ${solicitante}`}>
          <span className="planner-avatar" aria-hidden="true">
            {iniciales(solicitante)}
          </span>
          <span className="text-truncate planner-solicitante">{solicitante}</span>
        </span>

        {editable ? (
          <div className="d-flex flex-wrap gap-1">
            {acciones.retroceder ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={alRetroceder}
                aria-label={`Devolver a la etapa anterior: ${nombre}`}
                title="Devolver a la etapa anterior"
              >
                <i className="bi bi-arrow-left" aria-hidden="true" />
              </button>
            ) : null}
            {acciones.reagendar ? (
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={alReagendar}
                aria-label={`Reagendar entrevista de ${nombre}`}
                title="Reagendar entrevista"
              >
                <i className="bi bi-calendar-week" aria-hidden="true" />
              </button>
            ) : null}
            {acciones.requiereAgenda ? (
              <button type="button" className="btn btn-sm btn-primary" onClick={alAgendar}>
                <i className="bi bi-calendar-plus me-1" aria-hidden="true" />
                Agendar
                <span className="visually-hidden"> entrevista de {nombre}</span>
              </button>
            ) : null}
            {etapa === 'agendada' ? (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={alMarcarRealizada}
                aria-label={`Realizada: marcar entrevista de ${nombre}`}
              >
                <i className="bi bi-check2 me-1" aria-hidden="true" />
                Realizada
              </button>
            ) : null}
            {acciones.registrarInforme ? (
              <button type="button" className="btn btn-sm btn-primary" onClick={alRegistrarInforme}>
                <i className="bi bi-file-earmark-text me-1" aria-hidden="true" />
                Registrar informe
                <span className="visually-hidden"> de {nombre}</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
