import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useDatos } from '../datos/DatosContext';
import { ESTADOS_QUE_PERMITEN_EVALUAR } from '../datos/constantes';
import { formatearFecha } from '../dominio/formateo';
import EtiquetaEstado from '../componentes/comunes/EtiquetaEstado';
import Mensaje from '../componentes/comunes/Mensaje';
import PanelGestion from '../componentes/solicitudes/PanelGestion';
import FormularioEvaluacion from '../componentes/evaluacion/FormularioEvaluacion';

/** Detalle de solicitud: datos del candidato, gestión de estado y evaluación. */
export default function DetalleSolicitud() {
  const { id } = useParams();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const {
    obtenerSolicitud,
    obtenerCandidato,
    obtenerEvaluacionDeSolicitud,
    actualizarSolicitud,
    asignarProfesional,
    registrarEvaluacion,
  } = useDatos();

  const solicitud = obtenerSolicitud(id);
  const mensaje = ubicacion.state?.mensaje;
  const tipo = ubicacion.state?.tipo ?? 'success';

  if (!solicitud) {
    return (
      <Mensaje tipo="warning" titulo="Solicitud no encontrada">
        La solicitud solicitada no existe.
        <div className="mt-2">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => navegar('/solicitudes')}
          >
            Volver al listado
          </button>
        </div>
      </Mensaje>
    );
  }

  const candidato = obtenerCandidato(solicitud.candidatoId);
  const evaluacion = obtenerEvaluacionDeSolicitud(solicitud.id);
  const puedeEvaluar = ESTADOS_QUE_PERMITEN_EVALUAR.includes(solicitud.estado);
  const datosSolicitud = [
    ['Ubicación', [solicitud.ubicacion, solicitud.unidad].filter(Boolean).join(' · ')],
    ['CECO', solicitud.ceco],
    ['Requiere referencias', solicitud.requiereReferencias ? 'Sí' : 'No'],
    ['CV', solicitud.cv],
    ['Descriptor de cargo', solicitud.descriptorCargo],
  ];

  return (
    <div className="d-flex flex-column gap-3">
      <nav aria-label="miga de pan">
        <button
          type="button"
          className="btn btn-link btn-sm px-0"
          onClick={() => navegar('/solicitudes')}
        >
          <i className="bi bi-arrow-left me-1" aria-hidden="true" />
          Volver a solicitudes
        </button>
      </nav>

      <header className="d-flex flex-column flex-md-row justify-content-between gap-2">
        <div>
          <h1 className="h4 mb-1">
            Solicitud #{solicitud.id} · {candidato ? candidato.nombre : 'Candidato eliminado'}
          </h1>
          <p className="text-secondary mb-0">
            {solicitud.cargo} · {solicitud.familiaCargo} · {formatearFecha(solicitud.fechaSolicitud)}
          </p>
        </div>
        <EtiquetaEstado valor={solicitud.estado} className="align-self-start fs-6" />
      </header>

      {mensaje ? (
        <Mensaje tipo={tipo} alCerrar={() => navegar(`/solicitudes/${solicitud.id}`, { replace: true })}>
          {mensaje}
        </Mensaje>
      ) : null}

      <div className="row g-3">
        <div className="col-12 col-lg-5">
          <section className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white">
              <h2 className="h6 mb-0">Datos del candidato</h2>
            </div>
            <div className="card-body">
              {candidato ? (
                <dl className="row mb-0 small">
                  <dt className="col-5 text-secondary">Nombre</dt>
                  <dd className="col-7">{candidato.nombre}</dd>
                  <dt className="col-5 text-secondary">Correo</dt>
                  <dd className="col-7">{candidato.correo}</dd>
                  <dt className="col-5 text-secondary">Teléfono</dt>
                  <dd className="col-7">{candidato.telefono}</dd>
                  <dt className="col-5 text-secondary">Cargo</dt>
                  <dd className="col-7">{candidato.cargo}</dd>
                  <dt className="col-5 text-secondary">Familia</dt>
                  <dd className="col-7">{candidato.familiaCargo}</dd>
                  {candidato.origen ? (
                    <>
                      <dt className="col-5 text-secondary">Origen</dt>
                      <dd className="col-7">
                        {candidato.origen}
                        {solicitud.referido === true ? ' · Referido/a' : ''}
                      </dd>
                    </>
                  ) : null}
                </dl>
              ) : (
                <p className="text-secondary mb-0">
                  El candidato asociado fue eliminado del registro.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="col-12 col-lg-7">
          <PanelGestion
            solicitud={solicitud}
            alAsignarProfesional={(profesional) => asignarProfesional(solicitud.id, profesional)}
            alCambiarEstado={(estado) => actualizarSolicitud(solicitud.id, { estado })}
          />
        </div>
      </div>

      <section className="card border-0 shadow-sm">
        <div className="card-header bg-white">
          <h2 className="h6 mb-0">Datos de la solicitud</h2>
        </div>
        <div className="card-body">
          <dl className="row mb-0 small">
            {datosSolicitud.map(([etiqueta, valor]) => (
              <div key={etiqueta} className="col-12 col-sm-6 col-lg-4 mb-2">
                <dt className="text-secondary fw-normal">{etiqueta}</dt>
                <dd className="mb-0 text-break">{valor || '—'}</dd>
              </div>
            ))}
          </dl>
          {solicitud.observaciones ? (
            <div className="mt-3">
              <h3 className="h6 text-secondary small mb-1">Aspectos a indagar</h3>
              <p className="mb-0">{solicitud.observaciones}</p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="card border-0 shadow-sm">
        <div className="card-header bg-white d-flex flex-wrap justify-content-between gap-2 align-items-center">
          <h2 className="h6 mb-0">Evaluación psicolaboral</h2>
          {evaluacion ? (
            <div className="d-flex align-items-center gap-2">
              <EtiquetaEstado valor={evaluacion.resultado} contexto="resultado" />
              <EtiquetaEstado valor={evaluacion.estado} contexto="evaluacion" />
            </div>
          ) : (
            <span className="badge bg-light text-secondary">Sin evaluación</span>
          )}
        </div>
        <div className="card-body">
          {!puedeEvaluar ? (
            <Mensaje tipo="info">
              Para registrar o actualizar una evaluación, la solicitud debe estar en estado{' '}
              <strong>En proceso</strong>. Cámbiala desde el panel de gestión.
            </Mensaje>
          ) : null}

          {evaluacion ? (
            <div className="mb-3">
              <p className="small text-secondary mb-1">
                Fecha de evaluación: {formatearFecha(evaluacion.fechaEvaluacion)}
              </p>
              <p className="mb-0">{evaluacion.observaciones}</p>
            </div>
          ) : null}

          {puedeEvaluar ? (
            <FormularioEvaluacion
              evaluacion={evaluacion}
              alGuardar={(datos) => registrarEvaluacion(solicitud.id, datos)}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
