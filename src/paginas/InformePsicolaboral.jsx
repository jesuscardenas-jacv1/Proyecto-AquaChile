import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDatos } from '../datos/DatosContext';
import { useAuth } from '../datos/AuthContext';
import { formatearFecha } from '../dominio/formateo';
import logoAquaChile from '../assets/logo-aquachile-blanco.png';
import EtiquetaEstado from '../componentes/comunes/EtiquetaEstado';
import Mensaje from '../componentes/comunes/Mensaje';

const DESCRIPCIONES_DICTAMEN = {
  Recomendado:
    'El/La postulante evidencia las competencias, habilidades y motivación requeridas para desempeñar exitosamente las funciones del cargo, demostrando alineamiento con la cultura y estándares operativos de AquaChile.',
  'Recomendado con observaciones':
    'El/La postulante cumple con el perfil general requerido, sugiriéndose instancias de inducción reforzada, acompañamiento inicial o nivelación en los focos específicos señalados en la evaluación.',
  'No recomendado':
    'El/La postulante no se ajusta en este momento a los requerimientos conductuales o competencias críticas definidas para la posición en la compañía.',
};

/**
 * Vista de Informe Psicolaboral Oficial Imprimible.
 * Permite generar el documento corporativo final de la evaluación para entregar o imprimir en PDF.
 */
export default function InformePsicolaboral() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { esEvaluador } = useAuth();
  const { obtenerSolicitud, obtenerCandidato, obtenerEvaluacionDeSolicitud } = useDatos();

  const solicitud = obtenerSolicitud(id);

  if (!solicitud) {
    return (
      <div className="py-4">
        <Mensaje tipo="warning" titulo="Solicitud no encontrada">
          No existe una solicitud asociada al identificador #{id}.
          <div className="mt-3">
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => navegar('/solicitudes')}
            >
              Volver a solicitudes
            </button>
          </div>
        </Mensaje>
      </div>
    );
  }

  const candidato = obtenerCandidato(solicitud.candidatoId);
  const evaluacion = obtenerEvaluacionDeSolicitud(solicitud.id);

  if (!evaluacion) {
    return (
      <div className="py-4">
        <Mensaje tipo="info" titulo="Evaluación pendiente">
          La solicitud #{solicitud.id} aún no cuenta con una evaluación psicolaboral realizada.
          Para emitir el informe oficial, primero debe registrarse el veredicto en la ficha.
          <div className="mt-3">
            <Link to={`/solicitudes/${solicitud.id}`} className="btn btn-sm btn-primary">
              Volver al detalle de la solicitud
            </Link>
          </div>
        </Mensaje>
      </div>
    );
  }

  const folio = `FOLIO-APL-${String(solicitud.id).padStart(4, '0')}`;
  const descripcionVeredicto =
    DESCRIPCIONES_DICTAMEN[evaluacion.resultado] ||
    'Evaluación realizada conforme a pauta técnica por competencias.';

  return (
    <div className="py-3">
      {/* Barra de acciones superior (no se imprime) */}
      <div className="no-imprimir mb-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
        <Link
          to={`/solicitudes/${solicitud.id}`}
          className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
        >
          <i className="bi bi-arrow-left" aria-hidden="true" />
          <span>Volver al detalle</span>
        </Link>

        <button
          type="button"
          className="btn btn-primary btn-sm d-inline-flex align-items-center gap-2"
          onClick={() => window.print()}
        >
          <i className="bi bi-printer" aria-hidden="true" />
          <span>Imprimir / Guardar en PDF</span>
        </button>
      </div>

      {/* Hoja oficial de informe */}
      <article className="hoja-informe border overflow-hidden">
        {/* Cabecera institucional de marca */}
        <header className="cabecera-informe-marca d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3">
          <div className="d-flex align-items-center gap-3">
            <img src={logoAquaChile} alt="AquaChile" style={{ maxHeight: '38px', width: 'auto' }} />
            <div>
              <h1 className="h5 fw-bold mb-0 text-white">Informe Psicolaboral</h1>
              <p className="small text-white-50 mb-0">Gestión de Personas · Reclutamiento y Selección</p>
            </div>
          </div>
          <div className="text-sm-end text-white">
            <span className="badge bg-white text-dark fw-mono px-2 py-1 d-block d-sm-inline-block mb-1">
              {folio}
            </span>
            <small className="d-block text-white-50">
              Fecha: {formatearFecha(evaluacion.fechaEvaluacion)}
            </small>
          </div>
        </header>

        <div className="p-4 p-md-5">
          {/* Sección 1: Antecedentes del Postulante */}
          <section className="mb-4">
            <h2 className="h6 fw-bold text-uppercase border-bottom pb-2 text-primary">
              1. Antecedentes del Postulante
            </h2>
            <div className="row g-2 small">
              <div className="col-12 col-sm-6">
                <span className="text-secondary d-block">Nombre completo:</span>
                <strong className="fs-6">{candidato?.nombre || 'Postulante no individualizado'}</strong>
              </div>
              <div className="col-12 col-sm-6">
                <span className="text-secondary d-block">Cargo postulado:</span>
                <strong className="fs-6">{solicitud.cargo}</strong>
              </div>
              <div className="col-6 col-sm-3">
                <span className="text-secondary d-block">Familia de cargo:</span>
                <span>{solicitud.familiaCargo}</span>
              </div>
              <div className="col-6 col-sm-3">
                <span className="text-secondary d-block">Origen:</span>
                <span>{candidato?.origen || 'Externo'}</span>
              </div>
              <div className="col-6 col-sm-3">
                <span className="text-secondary d-block">Correo de contacto:</span>
                <span>{candidato?.correo || '—'}</span>
              </div>
              <div className="col-6 col-sm-3">
                <span className="text-secondary d-block">Teléfono:</span>
                <span>{candidato?.telefono || '—'}</span>
              </div>
            </div>
          </section>

          {/* Sección 2: Parámetros del Proceso */}
          <section className="mb-4">
            <h2 className="h6 fw-bold text-uppercase border-bottom pb-2 text-primary">
              2. Datos del Proceso de Selección
            </h2>
            <div className="row g-2 small">
              <div className="col-6 col-sm-3">
                <span className="text-secondary d-block">Fecha de solicitud:</span>
                <span>{formatearFecha(solicitud.fechaSolicitud)}</span>
              </div>
              <div className="col-6 col-sm-3">
                <span className="text-secondary d-block">Reclutador/a solicitante:</span>
                <span>{solicitud.reclutador || 'AquaChile'}</span>
              </div>
              <div className="col-6 col-sm-3">
                <span className="text-secondary d-block">Ubicación / Planta:</span>
                <span>{[solicitud.ubicacion, solicitud.unidad].filter(Boolean).join(' · ') || '—'}</span>
              </div>
              <div className="col-6 col-sm-3">
                <span className="text-secondary d-block">Centro de Costo (CECO):</span>
                <span>{solicitud.ceco || '—'}</span>
              </div>
            </div>
          </section>

          {/* Sección 3: Síntesis y Competencias */}
          <section className="mb-4">
            <h2 className="h6 fw-bold text-uppercase border-bottom pb-2 text-primary">
              3. Síntesis de Evaluación y Competencias
            </h2>
            {esEvaluador ? (
              <div className="bg-light p-3 rounded border">
                <p className="mb-0 text-secondary" style={{ whiteSpace: 'pre-line' }}>
                  {evaluacion.observaciones ||
                    'Evaluación completada mediante entrevista por competencias y revisión de antecedentes curriculares.'}
                </p>
              </div>
            ) : (
              <div className="alert alert-light border small text-secondary mb-0">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <i className="bi bi-shield-lock-fill text-primary" aria-hidden="true" />
                  <strong className="text-dark">Evaluación por Competencias Certificada</strong>
                </div>
                Las observaciones clínicas detalladas se encuentran resguardadas bajo secreto y
                confidencialidad profesional por el equipo de psicólogos evaluadores. El dictamen
                técnico oficial se presenta a continuación.
              </div>
            )}
          </section>

          {/* Sección 4: Dictamen Oficial */}
          <section className="mb-5">
            <h2 className="h6 fw-bold text-uppercase border-bottom pb-2 text-primary">
              4. Dictamen Final y Conclusión
            </h2>
            <div className="caja-dictamen p-3 p-md-4">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                <span className="fw-semibold text-secondary small text-uppercase">
                  Categoría de recomendación:
                </span>
                <EtiquetaEstado valor={evaluacion.resultado} contexto="resultado" className="fs-6" />
              </div>
              <p className="mb-0 text-dark small">{descripcionVeredicto}</p>
            </div>
          </section>

          {/* Sección 5: Firmas de Responsabilidad */}
          <section className="pt-4 mt-4 border-top">
            <div className="row text-center small">
              <div className="col-6">
                <div className="firma-linea" />
                <strong className="d-block text-dark">
                  {solicitud.profesionalResponsable || 'Profesional Evaluador'}
                </strong>
                <span className="text-secondary d-block">Psicología Laboral</span>
                <span className="text-secondary" style={{ fontSize: '0.75rem' }}>
                  Reclutamiento y Selección · AquaChile
                </span>
              </div>
              <div className="col-6">
                <div className="firma-linea" />
                <strong className="d-block text-dark">Dirección de Personas</strong>
                <span className="text-secondary d-block">Gestión del Talento</span>
                <span className="text-secondary" style={{ fontSize: '0.75rem' }}>
                  Empresas AquaChile S.A.
                </span>
              </div>
            </div>
          </section>
        </div>
      </article>
    </div>
  );
}
