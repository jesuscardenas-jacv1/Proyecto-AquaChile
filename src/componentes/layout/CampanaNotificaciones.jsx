import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { tiempoTranscurrido } from '../../dominio/formateo';
import { apiNotificaciones, obtenerToken } from '../../servicios/api';
import { suscribirTiempoReal } from '../../servicios/tiempoReal';

const SELECTOR_ENFOCABLES =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const ICONOS = {
  postulacion: 'bi-person-lines-fill',
  candidato: 'bi-person-plus',
  solicitud: 'bi-clipboard-plus',
  asignacion: 'bi-person-check',
};
const SEGUNDOS_AVISO = 6000;

/** Ventana con las notificaciones; se cierra con Cerrar, Escape o un clic fuera. */
function VentanaNotificaciones({ notificaciones, noLeidas, alAbrir, alMarcarTodas, alCerrar }) {
  const refDialogo = useRef(null);
  const refCerrarBoton = useRef(null);
  const refCerrar = useRef(alCerrar);
  refCerrar.current = alCerrar;

  useEffect(() => {
    const enfocadoAntes = document.activeElement;
    document.body.classList.add('modal-open');
    refCerrarBoton.current?.focus();

    const alPresionarTecla = (evento) => {
      if (evento.key === 'Escape') {
        refCerrar.current();
        return;
      }
      if (evento.key !== 'Tab' || !refDialogo.current) return;
      const enfocables = [...refDialogo.current.querySelectorAll(SELECTOR_ENFOCABLES)];
      if (enfocables.length === 0) return;
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener('keydown', alPresionarTecla);

    return () => {
      document.removeEventListener('keydown', alPresionarTecla);
      document.body.classList.remove('modal-open');
      enfocadoAntes?.focus?.();
    };
  }, []);

  return createPortal(
    <>
      <div
        ref={refDialogo}
        className="modal d-block"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ventana-notificaciones-titulo"
        tabIndex={-1}
        onMouseDown={(evento) => {
          if (evento.target === evento.currentTarget) alCerrar();
        }}
      >
        <div className="modal-dialog modal-dialog-scrollable">
          <div className="modal-content border-0 shadow">
            <div className="modal-header">
              <h2 id="ventana-notificaciones-titulo" className="h5 mb-0">
                Notificaciones
              </h2>
              <button ref={refCerrarBoton} type="button" className="btn-close" aria-label="Cerrar" onClick={alCerrar} />
            </div>
            <div className="modal-body p-0">
              {notificaciones.length === 0 ? (
                <p className="text-secondary text-center py-5 mb-0">No tienes notificaciones.</p>
              ) : (
                <ul className="list-unstyled mb-0">
                  {notificaciones.map((notificacion) => (
                    <li key={notificacion.id}>
                      <button
                        type="button"
                        className={`notificacion-item d-flex gap-3 w-100 text-start ${
                          notificacion.leida ? '' : 'notificacion-nueva'
                        }`.trim()}
                        onClick={() => alAbrir(notificacion)}
                      >
                        <i
                          className={`bi ${ICONOS[notificacion.tipo] ?? 'bi-bell'} text-secondary`}
                          aria-hidden="true"
                        />
                        <span className="flex-grow-1">
                          <span className={`d-block small ${notificacion.leida ? '' : 'fw-semibold'}`.trim()}>
                            {notificacion.mensaje}
                          </span>
                          <span className="d-block small text-secondary">
                            {tiempoTranscurrido(notificacion.creadaEn)}
                            {notificacion.leida ? '' : ' · Sin leer'}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="modal-footer">
              {noLeidas > 0 ? (
                <button type="button" className="btn btn-outline-primary me-auto" onClick={alMarcarTodas}>
                  Marcar todas como leídas
                </button>
              ) : null}
              <button type="button" className="btn btn-primary" onClick={alCerrar}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>,
    document.body,
  );
}

/**
 * Campana del menú con los avisos del usuario: postulaciones nuevas para el analista y
 * solicitudes nuevas o asignadas para la psicóloga. Se actualiza al cambiar de pantalla,
 * al volver a la ventana y cada cierto tiempo. Necesita el servidor: sin sesión en él
 * (modo demostración) no se muestra.
 */
export default function CampanaNotificaciones({ api = apiNotificaciones, intervalo = 30000 }) {
  const { pathname } = useLocation();
  const navegar = useNavigate();
  const [abierta, setAbierta] = useState(false);
  const [datos, setDatos] = useState({ noLeidas: 0, notificaciones: [] });
  const [avisoNuevo, setAvisoNuevo] = useState(null);
  const conServidor = Boolean(obtenerToken());

  const cargar = useCallback(async () => {
    if (!obtenerToken()) return;
    try {
      const { noLeidas, notificaciones } = await api.listar();
      setDatos({ noLeidas, notificaciones });
    } catch {
      // Sin conexión se conservan los avisos ya cargados; se reintenta en el próximo ciclo.
    }
  }, [api]);

  useEffect(() => {
    cargar();
  }, [cargar, pathname]);

  // Aviso en tiempo real: se suma a la campana y se muestra un momento en pantalla.
  useEffect(
    () =>
      suscribirTiempoReal('notificacion', (aviso) => {
        setDatos((actual) => ({
          noLeidas: actual.noLeidas + 1,
          notificaciones: [aviso, ...actual.notificaciones.filter((n) => n.id !== aviso.id)].slice(0, 30),
        }));
        setAvisoNuevo(aviso);
        cargar();
      }),
    [cargar],
  );

  useEffect(() => {
    if (!avisoNuevo) return undefined;
    const temporizador = setTimeout(() => setAvisoNuevo(null), SEGUNDOS_AVISO);
    return () => clearTimeout(temporizador);
  }, [avisoNuevo]);

  useEffect(() => {
    const siVisible = () => {
      if (!document.hidden) cargar();
    };
    const temporizador = setInterval(siVisible, intervalo);
    window.addEventListener('focus', cargar);
    document.addEventListener('visibilitychange', siVisible);
    return () => {
      clearInterval(temporizador);
      window.removeEventListener('focus', cargar);
      document.removeEventListener('visibilitychange', siVisible);
    };
  }, [cargar, intervalo]);

  if (!conServidor) return null;

  const abrirNotificacion = async (notificacion) => {
    setAbierta(false);
    if (notificacion.enlace) navegar(notificacion.enlace);
    if (notificacion.leida) return;
    try {
      await api.marcarLeida(notificacion.id);
    } catch {
      // Se reintenta la próxima vez que la abra.
    }
    cargar();
  };

  const marcarTodas = async () => {
    try {
      await api.marcarTodas();
    } catch {
      // Sin conexión quedan sin leer.
    }
    cargar();
  };

  const { noLeidas, notificaciones } = datos;

  return (
    <>
      {avisoNuevo ? createPortal(
        <div className="aviso-tiempo-real" role="status" aria-live="polite">
          <i className={`bi ${ICONOS[avisoNuevo.tipo] ?? 'bi-bell'}`} aria-hidden="true" />
          <span className="flex-grow-1">{avisoNuevo.mensaje}</span>
          {avisoNuevo.enlace ? (
            <button
              type="button"
              className="btn btn-sm btn-acento"
              onClick={() => {
                navegar(avisoNuevo.enlace);
                setAvisoNuevo(null);
              }}
            >
              Ver
            </button>
          ) : null}
          <button type="button" className="btn-close btn-close-white" aria-label="Cerrar aviso" onClick={() => setAvisoNuevo(null)} />
        </div>,
        document.body,
      ) : null}
      <button
        type="button"
        className="btn btn-outline-light border-0 barra-campana position-relative"
        aria-label={noLeidas > 0 ? `Notificaciones: ${noLeidas} sin leer` : 'Notificaciones'}
        aria-haspopup="dialog"
        title="Notificaciones"
        onClick={() => setAbierta(true)}
      >
        <i className={`bi ${noLeidas > 0 ? 'bi-bell-fill' : 'bi-bell'}`} aria-hidden="true" />
        {noLeidas > 0 ? (
          <span className="badge rounded-pill bg-acento barra-campana-contador" aria-hidden="true">
            {noLeidas > 9 ? '9+' : noLeidas}
          </span>
        ) : null}
      </button>
      {abierta ? (
        <VentanaNotificaciones
          notificaciones={notificaciones}
          noLeidas={noLeidas}
          alAbrir={abrirNotificacion}
          alMarcarTodas={marcarTodas}
          alCerrar={() => setAbierta(false)}
        />
      ) : null}
    </>
  );
}
