import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDatos } from '../datos/DatosContext';
import { useAuth } from '../datos/AuthContext';
import { ETAPAS_PLANNER, PROFESIONALES } from '../datos/constantes';
import { agruparPorEtapa, etapaAnterior, hoyIso, obtenerEtapa, textoEntrevista } from '../dominio/planner';
import { normalizar } from '../dominio/texto';
import Mensaje from '../componentes/comunes/Mensaje';
import ColumnaPlanner from '../componentes/planner/ColumnaPlanner';
import TarjetaPlanner from '../componentes/planner/TarjetaPlanner';
import VentanaAgenda from '../componentes/planner/VentanaAgenda';
import { mensajeDeError } from '../servicios/errores';

/**
 * Planner de la psicóloga: tablero con las 4 etapas del proceso
 * (Evaluación Recibida → Entrevista Agendada → Entrevista Realizada → Informe enviado),
 * equivalente al Microsoft Planner "Status Evaluaciones" que usa hoy AquaChile.
 *
 * - Perfil evaluador: agenda entrevistas, las marca como realizadas y pasa a registrar el informe.
 * - Perfil analista: ve en qué etapa está cada solicitud, sin poder moverlas.
 */
export default function Planner() {
  const navegar = useNavigate();
  const { esEvaluador } = useAuth();
  const { solicitudes, candidatos, evaluaciones, moverEtapa } = useDatos();
  const [texto, setTexto] = useState('');
  const [solicitante, setSolicitante] = useState('');
  const [ventana, setVentana] = useState(null);
  const [aviso, setAviso] = useState(null);
  const hoy = hoyIso();

  const candidatosPorId = useMemo(
    () => Object.fromEntries(candidatos.map((candidato) => [candidato.id, candidato])),
    [candidatos],
  );
  const evaluacionesPorSolicitud = useMemo(
    () => Object.fromEntries(evaluaciones.map((evaluacion) => [evaluacion.solicitudId, evaluacion])),
    [evaluaciones],
  );

  const filtradas = useMemo(() => {
    const busqueda = normalizar(texto.trim());
    return solicitudes.filter((solicitud) => {
      if (solicitante && solicitud.profesionalResponsable !== solicitante) return false;
      if (!busqueda) return true;
      const candidato = candidatosPorId[solicitud.candidatoId];
      return normalizar(
        [candidato?.nombre, solicitud.cargo, solicitud.familiaCargo, solicitud.profesionalResponsable].join(' '),
      ).includes(busqueda);
    });
  }, [solicitudes, texto, solicitante, candidatosPorId]);

  const grupos = useMemo(() => agruparPorEtapa(filtradas, evaluaciones), [filtradas, evaluaciones]);
  const hayFiltros = Boolean(texto || solicitante);
  // Los filtros del Planner se mantienen al abrir la pantalla de informes enviados.
  const enlaceInformes = `/planner/informes${
    hayFiltros
      ? `?${new URLSearchParams({ ...(texto ? { q: texto } : {}), ...(solicitante ? { solicitante } : {}) })}`
      : ''
  }`;

  const nombreDe = (solicitud) => candidatosPorId[solicitud.candidatoId]?.nombre ?? 'el candidato';

  /** Ejecuta un movimiento de etapa; si la API lo rechaza, muestra el motivo. */
  const mover = async (solicitud, etapa, agenda) => {
    try {
      await moverEtapa(solicitud.id, etapa, agenda);
      return true;
    } catch (error) {
      setAviso({ tipo: 'danger', texto: `No se pudo mover a ${nombreDe(solicitud)}: ${mensajeDeError(error)}` });
      return false;
    }
  };

  const guardarAgenda = async (agenda) => {
    const { solicitud, reagendar } = ventana;
    setVentana(null);
    if (!(await mover(solicitud, 'agendada', agenda))) return;
    setAviso({
      tipo: 'success',
      texto: `${reagendar ? 'Entrevista reagendada' : 'Entrevista agendada'}: ${nombreDe(solicitud)}. ${textoEntrevista(
        { ...solicitud, ...agenda },
      )} (${agenda.modalidadEntrevista}).`,
    });
  };

  const marcarRealizada = async (solicitud) => {
    if (!(await mover(solicitud, 'realizada'))) return;
    setAviso({
      tipo: 'success',
      texto: `Entrevista de ${nombreDe(solicitud)} marcada como realizada. Siguiente paso: registrar la evaluación y el informe.`,
    });
  };

  const retroceder = async (solicitud, etapaActual) => {
    const destino = etapaAnterior(etapaActual);
    if (!(await mover(solicitud, destino))) return;
    setAviso({
      tipo: 'info',
      texto: `${nombreDe(solicitud)} volvió a "${obtenerEtapa(destino).titulo}".`,
    });
  };

  return (
    <div className="d-flex flex-column gap-3">
      <header className="d-flex flex-column flex-md-row justify-content-between gap-2 align-items-md-center">
        <div>
          <h1 className="h4 mb-1">Planner de evaluaciones</h1>
          <p className="text-secondary mb-0">
            Seguimiento de cada solicitud desde que se recibe hasta el envío del informe psicolaboral.
          </p>
        </div>
        {!esEvaluador ? (
          <span className="badge bg-light text-secondary border align-self-start align-self-md-center">
            <i className="bi bi-eye me-1" aria-hidden="true" />
            Vista de solo lectura
          </span>
        ) : null}
      </header>

      <div aria-live="polite">
        {aviso ? (
          <Mensaje tipo={aviso.tipo} alCerrar={() => setAviso(null)}>
            {aviso.texto}
          </Mensaje>
        ) : null}
      </div>

      <section className="card border-0 shadow-sm" aria-label="Filtros del Planner">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-6 col-lg-5">
              <label className="form-label small text-secondary mb-1" htmlFor="planner-busqueda">
                Buscar
              </label>
              <div className="input-group">
                <span className="input-group-text bg-white">
                  <i className="bi bi-search" aria-hidden="true" />
                </span>
                <input
                  id="planner-busqueda"
                  type="search"
                  className="form-control"
                  placeholder="Candidato, cargo o familia"
                  value={texto}
                  onChange={(evento) => setTexto(evento.target.value)}
                />
              </div>
            </div>
            <div className="col-12 col-md-4 col-lg-3">
              <label className="form-label small text-secondary mb-1" htmlFor="planner-solicitante">
                Solicitado por
              </label>
              <select
                id="planner-solicitante"
                className="form-select"
                value={solicitante}
                onChange={(evento) => setSolicitante(evento.target.value)}
              >
                <option value="">Todos los reclutadores/as</option>
                {PROFESIONALES.map((nombre) => (
                  <option key={nombre} value={nombre}>
                    {nombre}
                  </option>
                ))}
              </select>
            </div>
            {hayFiltros ? (
              <div className="col-12 col-md-2 col-lg-auto">
                <button
                  type="button"
                  className="btn btn-outline-primary w-100"
                  onClick={() => {
                    setTexto('');
                    setSolicitante('');
                  }}
                >
                  Limpiar
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="row g-3 planner-tablero">
        {ETAPAS_PLANNER.map((etapa) => (
          <div key={etapa.id} className="col-12 col-md-6 col-xl-3">
            <ColumnaPlanner
              etapa={etapa}
              cantidad={grupos[etapa.id].length}
              completadas={etapa.id === 'informe'}
              enlaceVerTodos={etapa.id === 'informe' ? enlaceInformes : undefined}
            >
              {grupos[etapa.id].map((solicitud) => (
                <TarjetaPlanner
                  key={solicitud.id}
                  solicitud={solicitud}
                  candidato={candidatosPorId[solicitud.candidatoId]}
                  evaluacion={evaluacionesPorSolicitud[solicitud.id]}
                  etapa={etapa.id}
                  hoy={hoy}
                  editable={esEvaluador}
                  alAgendar={() => setVentana({ solicitud, reagendar: false })}
                  alReagendar={() => setVentana({ solicitud, reagendar: true })}
                  alMarcarRealizada={() => marcarRealizada(solicitud)}
                  alRegistrarInforme={() => navegar(`/solicitudes/${solicitud.id}`)}
                  alRetroceder={() => retroceder(solicitud, etapa.id)}
                />
              ))}
            </ColumnaPlanner>
          </div>
        ))}
      </div>

      {ventana ? (
        <VentanaAgenda
          solicitud={ventana.solicitud}
          candidato={candidatosPorId[ventana.solicitud.candidatoId]}
          reagendar={ventana.reagendar}
          alGuardar={guardarAgenda}
          alCerrar={() => setVentana(null)}
        />
      ) : null}
    </div>
  );
}
