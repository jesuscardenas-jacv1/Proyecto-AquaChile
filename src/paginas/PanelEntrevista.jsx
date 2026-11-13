import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDatos } from '../datos/DatosContext';
import { etapaDeSolicitud, textoEntrevista } from '../dominio/planner';
import {
  agregarLinea,
  citaParaNotas,
  competenciasConNotas,
  confirmacionCierre,
  marcaTiempo,
  resultadoCierre,
  textoTranscripcion,
} from '../dominio/entrevista';
import { COMPETENCIAS } from '../datos/constantes';

import { apiEntrevista } from '../servicios/apiEntrevista';
import { useEstadoIa } from '../servicios/apiIa';
import { iniciarTranscripcionEnVivo, puedeTranscribirEnVivo } from '../servicios/transcriptorVivo';
import Mensaje from '../componentes/comunes/Mensaje';
import BotonReunion from '../componentes/comunes/BotonReunion';
import ResumenCvLateral from '../componentes/entrevista/ResumenCvLateral';
import TranscripcionEnVivo from '../componentes/entrevista/TranscripcionEnVivo';
import NotasEntrevistaPanel from '../componentes/entrevista/NotasEntrevistaPanel';

/**
 * Panel de entrevista de la psicóloga (se abre desde la tarjeta "Entrevista Agendada" del Planner).
 *
 * - Izquierda: "Mis notas", que se guardan solas (arriba: es lo que la psicóloga escribe), y la
 *   transcripción en vivo (Azure AI Speech, con el consentimiento del postulante), que avanza sola.
 * - Derecha: resumen del análisis del CV que hizo el analista con IA, con las preguntas sugeridas
 *   para ir marcando.
 * - Al terminar: guarda la transcripción como pauta, la IA propone notas por competencia, la
 *   entrevista pasa a "Entrevista Realizada" y se abre la solicitud para registrar la evaluación.
 */
/** Texto del botón de cierre según la etapa y si hay IA en el servidor. */
function textoBotonCierre({ agendada, conIa }) {
  if (agendada) return conIa ? 'Terminar y generar notas por competencia (IA)' : 'Terminar entrevista';
  return conIa ? 'Guardar transcripción y generar notas (IA)' : 'Guardar transcripción';
}

export default function PanelEntrevista({
  api = apiEntrevista,
  transcribir = iniciarTranscripcionEnVivo,
  transcripcionPosible = puedeTranscribirEnVivo,
  estadoIa: estadoInyectado,
  retardoGuardado = 1500,
  // Si en este tiempo de grabación no llega ninguna frase, se avisa (micrófono o fuente de audio).
  segundosSinFrases = 30,
}) {
  const { id } = useParams();
  const solicitudId = Number(id);
  const navegar = useNavigate();
  const { obtenerSolicitud, obtenerCandidato, moverEtapa } = useDatos();
  const estadoServidor = useEstadoIa();
  const { disponible: iaDisponible, voz: vozDisponible } = estadoInyectado ?? estadoServidor;
  const solicitud = obtenerSolicitud(solicitudId);
  const candidato = solicitud ? obtenerCandidato(solicitud.candidatoId) : null;
  const etapa = etapaDeSolicitud(solicitud);

  const [carga, setCarga] = useState({ cargando: true, error: null, analisis: null, tienePostulacion: false });
  const [notas, setNotas] = useState('');
  const [segmentos, setSegmentos] = useState([]);
  const [preguntas, setPreguntas] = useState([]);
  const [hablantes, setHablantes] = useState({});
  const [segundos, setSegundos] = useState(0);
  const [cambios, setCambios] = useState(0);
  const [guardado, setGuardado] = useState({ guardadoEn: null, guardando: false, error: null });
  const [ahora, setAhora] = useState(Date.now());

  const [modo, setModo] = useState('microfono');
  const [consentimiento, setConsentimiento] = useState(false);
  const [estado, setEstado] = useState('inactivo');
  const [parcial, setParcial] = useState(null);
  const [nivel, setNivel] = useState(0);
  const [errorVoz, setErrorVoz] = useState(null);
  const [lateralPlegado, setLateralPlegado] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [errorCierre, setErrorCierre] = useState(null);

  const control = useRef(null);
  // Inicio de la grabación en curso (segundos y frases), para avisar si no se reconoce voz.
  const [sesion, setSesion] = useState(null);
  // Lo último de la entrevista, para guardar desde temporizadores y al salir sin depender del render.
  const actual = useRef({ notas, transcripcion: segmentos, preguntas, hablantes, segundosAudio: segundos });
  actual.current = { notas, transcripcion: segmentos, preguntas, hablantes, segundosAudio: segundos };
  const pendiente = useRef(false);

  const marcarCambio = () => {
    pendiente.current = true;
    setCambios((valor) => valor + 1);
  };

  // Carga lo guardado y el análisis del CV.
  useEffect(() => {
    let vigente = true;
    api
      .obtener(solicitudId)
      .then(({ entrevista, analisis, tienePostulacion }) => {
        if (!vigente) return;
        setNotas(entrevista.notas ?? '');
        setSegmentos(entrevista.transcripcion ?? []);
        setPreguntas(entrevista.preguntas ?? []);
        setHablantes(entrevista.hablantes ?? {});
        setSegundos(Math.round(entrevista.segundosAudio ?? 0));
        setGuardado((previo) => ({ ...previo, guardadoEn: entrevista.actualizadoEn }));
        setCarga({ cargando: false, error: null, analisis, tienePostulacion });
      })
      .catch((error) => vigente && setCarga({ cargando: false, error: error.message, analisis: null, tienePostulacion: false }));
    return () => {
      vigente = false;
    };
  }, [api, solicitudId]);

  const guardarAhora = useCallback(async () => {
    if (!pendiente.current) return true;
    pendiente.current = false;
    setGuardado((previo) => ({ ...previo, guardando: true, error: null }));
    try {
      const guardada = await api.guardar(solicitudId, actual.current);
      setGuardado({ guardando: false, error: null, guardadoEn: guardada?.actualizadoEn ?? new Date().toISOString() });
      return true;
    } catch (error) {
      pendiente.current = true;
      setGuardado((previo) => ({ ...previo, guardando: false, error: `No se pudo guardar: ${error.message}` }));
      return false;
    }
  }, [api, solicitudId]);

  // Guardado automático un momento después del último cambio.
  useEffect(() => {
    if (!cambios) return undefined;
    const temporizador = setTimeout(guardarAhora, retardoGuardado);
    return () => clearTimeout(temporizador);
  }, [cambios, guardarAhora, retardoGuardado]);

  // Reloj para "Guardado hace X s" y el cronómetro de la grabación.
  useEffect(() => {
    const intervalo = setInterval(() => {
      setAhora(Date.now());
      if (control.current && estado === 'grabando') {
        setSegundos((valor) => valor + 1);
        pendiente.current = true;
      }
    }, 1000);
    return () => clearInterval(intervalo);
  }, [estado]);

  // Medidor de audio mientras se graba.
  useEffect(() => {
    if (estado !== 'grabando') return undefined;
    const intervalo = setInterval(() => setNivel(control.current?.nivel?.() ?? 0), 150);
    return () => clearInterval(intervalo);
  }, [estado]);

  // Al salir: corta la grabación y guarda lo pendiente. Con la grabación activa, avisa antes de cerrar la pestaña.
  useEffect(() => {
    const avisar = (evento) => {
      if (!control.current && !pendiente.current) return;
      evento.preventDefault();
      evento.returnValue = '';
    };
    window.addEventListener('beforeunload', avisar);
    return () => {
      window.removeEventListener('beforeunload', avisar);
      control.current?.detener();
      control.current = null;
      if (pendiente.current) api.guardar(solicitudId, actual.current).catch(() => {});
    };
  }, [api, solicitudId]);

  const detenerGrabacion = useCallback(async () => {
    const vigente = control.current;
    control.current = null;
    setParcial(null);
    setNivel(0);
    if (vigente) {
      setEstado('pausado');
      await vigente.detener();
    }
  }, []);

  const comenzar = async () => {
    const desde = estado;
    setErrorVoz(null);
    setEstado('iniciando');
    try {
      control.current = await transcribir({
        modo,
        obtenerToken: () => api.tokenVoz(),
        inicioMs: actual.current.segundosAudio * 1000,
        alSegmento: (segmento) => {
          setSegmentos((previos) => [...previos, segmento]);
          marcarCambio();
        },
        alParcial: setParcial,
        alError: (mensaje) => {
          setErrorVoz(mensaje);
          detenerGrabacion();
        },
        alTerminar: () => {
          setErrorVoz('Se dejó de compartir el audio: la grabación quedó en pausa.');
          detenerGrabacion();
        },
      });
      setSesion({ segundos: actual.current.segundosAudio, frases: actual.current.transcripcion.length });
      setEstado('grabando');
    } catch (error) {
      control.current = null;
      setErrorVoz(error.message);
      setEstado(desde === 'pausado' ? 'pausado' : 'inactivo');
    }
  };

  const cambiarNotas = (valor) => {
    setNotas(valor);
    marcarCambio();
  };

  const marcarPregunta = (pregunta) => {
    setPreguntas((previas) => (previas.includes(pregunta) ? previas.filter((p) => p !== pregunta) : [...previas, pregunta]));
    marcarCambio();
  };

  const asignarHablante = (idHablante, rol) => {
    setHablantes((previos) => ({ ...previos, [idHablante]: rol }));
    marcarCambio();
  };

  const citar = (segmento) => cambiarNotas(agregarLinea(notas, citaParaNotas(segmento, hablantes)));

  const guardarYSalir = async () => {
    await detenerGrabacion();
    if (await guardarAhora()) {
      navegar('/planner', { state: { mensaje: `Entrevista de ${candidato?.nombre ?? 'el candidato'} guardada: puedes continuarla desde el Planner.` } });
    }
  };

  /**
   * Cierra la entrevista: guarda la pauta y pide las notas a la IA. Con la entrevista agendada
   * además la marca como realizada; ya realizada, sirve para procesar lo que se grabó después.
   */
  const terminarEntrevista = async () => {
    const mueveEtapa = etapa === 'agendada';
    const confirmado = window.confirm(
      confirmacionCierre({ frases: actual.current.transcripcion.length, segundos: actual.current.segundosAudio, mueveEtapa }),
    );
    if (!confirmado) return;
    setCerrando(true);
    setErrorCierre(null);
    try {
      await detenerGrabacion();
      pendiente.current = true;
      if (!(await guardarAhora())) throw new Error('No se pudieron guardar las notas. Revisa la conexión e intenta de nuevo.');

      let notasParaBorrador = actual.current.notas;
      let respuesta = null;
      const transcripcion = textoTranscripcion(actual.current.transcripcion, actual.current.hablantes);
      if (api.conectado()) {
        respuesta = await api.cerrar(solicitudId, {
          transcripcion,
          notas: actual.current.notas,
          segundosAudio: actual.current.segundosAudio,
          // Grabar exigió el consentimiento: si hay transcripción, el postulante lo dio.
          consentimiento: consentimiento || actual.current.transcripcion.length > 0,
        });
        notasParaBorrador = respuesta.notas?.notas || notasParaBorrador || transcripcion;
      }

      if (mueveEtapa && !(await moverEtapa(solicitudId, 'realizada'))) {
        throw new Error('No se pudo marcar la entrevista como realizada.');
      }
      const { mensaje, tipo } = resultadoCierre({ respuesta, conTranscripcion: Boolean(transcripcion), conServidor: api.conectado() });
      navegar(`/solicitudes/${solicitudId}`, { state: { mensaje, tipo, notasEntrevista: notasParaBorrador } });
    } catch (error) {
      setErrorCierre(error.message);
      setCerrando(false);
    }
  };

  if (!solicitud) {
    return (
      <Mensaje tipo="warning" titulo="Solicitud no encontrada">
        La solicitud #{id} no existe. <Link to="/planner">Volver al Planner</Link>.
      </Mensaje>
    );
  }
  if (etapa === 'cerrada') {
    return (
      <Mensaje tipo="info" titulo="Solicitud cerrada">
        La solicitud se cerró sin evaluación. <Link to="/planner">Volver al Planner</Link>.
      </Mensaje>
    );
  }

  const conVoz = vozDisponible && api.conectado();
  const grabando = estado === 'grabando' || estado === 'iniciando';
  const sinFrases =
    estado === 'grabando' && sesion && segundos - sesion.segundos >= segundosSinFrases && segmentos.length === sesion.frases;
  const sePuedeCerrar = etapa === 'agendada' || (etapa === 'realizada' && (segmentos.length > 0 || notas.trim()));
  const cubiertas = competenciasConNotas(notas).length;

  return (
    <div className="d-flex flex-column gap-3 panel-entrevista">
      <header className="d-flex flex-wrap align-items-center gap-3">
        <Link to="/planner" className="btn btn-sm btn-outline-secondary">
          <i className="bi bi-arrow-left me-1" aria-hidden="true" />
          Volver al Planner
        </Link>
        <div className="me-auto">
          <h1 className="h4 mb-0">{candidato?.nombre ?? 'Candidato'}</h1>
          <p className="small text-secondary mb-0">
            <span className="badge bg-primary-subtle text-primary-emphasis me-2">{solicitud.cargo}</span>
            {textoEntrevista(solicitud)}
            {solicitud.modalidadEntrevista ? ` · ${solicitud.modalidadEntrevista}` : ''}
          </p>
        </div>
        {grabando || estado === 'pausado' ? (
          <span
            className={`badge rounded-pill ${estado === 'pausado' ? 'text-bg-secondary' : 'bg-danger-subtle text-danger-emphasis'} px-3 py-2`}
            role="status"
          >
            <i className={`bi ${estado === 'pausado' ? 'bi-pause-fill' : 'bi-record-circle'} me-1`} aria-hidden="true" />
            {estado === 'pausado' ? 'En pausa' : 'Grabando'} {marcaTiempo(segundos * 1000)}
          </span>
        ) : null}
        <BotonReunion enlace={solicitud.enlaceReunion} modalidad={solicitud.modalidadEntrevista} />
      </header>

      {etapa !== 'agendada' ? (
        <Mensaje tipo="info">
          Esta entrevista ya no está en «Entrevista Agendada». Puedes completar tus notas o seguir grabando y luego{' '}
          {etapa === 'realizada' ? 'guardar la transcripción y generar las notas con el botón de abajo' : 'revisarlas'}; la
          evaluación se registra en la <Link to={`/solicitudes/${solicitudId}`}>solicitud</Link>.
        </Mensaje>
      ) : null}
      <div aria-live="assertive">
        {errorVoz ? (
          <Mensaje tipo="warning" alCerrar={() => setErrorVoz(null)}>
            <i className="bi bi-mic-mute me-1" aria-hidden="true" />
            {errorVoz}
          </Mensaje>
        ) : null}
        {sinFrases ? (
          <Mensaje tipo="warning">
            <i className="bi bi-soundwave me-1" aria-hidden="true" />
            Llevas {marcaTiempo((segundos - sesion.segundos) * 1000)} grabando y no se ha transcrito ninguna frase. Revisa que el
            micrófono capte voz (el medidor debe moverse) y la fuente de audio elegida.
          </Mensaje>
        ) : null}
      </div>
      {carga.error ? <Mensaje tipo="danger">No se pudo cargar la entrevista: {carga.error}</Mensaje> : null}

      {carga.cargando ? (
        <p className="text-secondary" role="status">
          <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
          Cargando la entrevista…
        </p>
      ) : (
        <div className="row g-3">
          <div className={lateralPlegado ? 'col-12' : 'col-12 col-lg-8'}>
            <div className="d-flex flex-column gap-3">
              <NotasEntrevistaPanel
                notas={notas}
                alCambiar={cambiarNotas}
                milisegundosActuales={segundos * 1000}
                guardado={guardado}
                ahora={ahora}
              />
              <TranscripcionEnVivo
                disponible={conVoz}
                estado={estado}
                modo={modo}
                modosPosibles={{ microfono: transcripcionPosible('microfono'), reunion: transcripcionPosible('reunion') }}
                alCambiarModo={setModo}
                consentimiento={consentimiento}
                alCambiarConsentimiento={setConsentimiento}
                segmentos={segmentos}
                parcial={parcial}
                hablantes={hablantes}
                alAsignarHablante={asignarHablante}
                alCitar={citar}
                alComenzar={comenzar}
                alPausar={detenerGrabacion}
                alReanudar={comenzar}
                nivel={nivel}
              />
            </div>
          </div>
          {lateralPlegado ? null : (
            <div className="col-12 col-lg-4">
              <ResumenCvLateral
                analisis={carga.analisis}
                tienePostulacion={carga.tienePostulacion}
                observaciones={solicitud.observaciones}
                preguntasHechas={preguntas}
                alMarcarPregunta={marcarPregunta}
                alPlegar={() => setLateralPlegado(true)}
              />
            </div>
          )}
        </div>
      )}

      <footer className="panel-entrevista-pie d-flex flex-wrap align-items-center gap-3 py-2">
        <span className="small text-secondary">
          <i className="bi bi-clock me-1" aria-hidden="true" />
          Tiempo grabado: <strong className="font-monospace">{marcaTiempo(segundos * 1000)}</strong>
        </span>
        <span className="small text-secondary me-auto">
          <i className="bi bi-diagram-3 me-1" aria-hidden="true" />
          Competencias con notas: <strong>{cubiertas} de {COMPETENCIAS.length}</strong>
        </span>
        {lateralPlegado ? (
          <button type="button" className="btn btn-sm btn-link" onClick={() => setLateralPlegado(false)}>
            <i className="bi bi-layout-sidebar-reverse me-1" aria-hidden="true" />
            Ver resumen del CV
          </button>
        ) : null}
        {errorCierre ? (
          <span className="small text-danger w-100 order-last" role="alert">
            {errorCierre}
          </span>
        ) : null}
        <button type="button" className="btn btn-outline-primary" onClick={guardarYSalir} disabled={cerrando}>
          Guardar y continuar después
        </button>
        {sePuedeCerrar ? (
          <button type="button" className="btn btn-primary" onClick={terminarEntrevista} disabled={cerrando || carga.cargando}>
            {cerrando ? (
              <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
            ) : (
              <i className="bi bi-stars me-2" aria-hidden="true" />
            )}
            {cerrando ? 'Terminando…' : textoBotonCierre({ agendada: etapa === 'agendada', conIa: iaDisponible && api.conectado() })}
          </button>
        ) : null}
      </footer>
    </div>
  );
}
