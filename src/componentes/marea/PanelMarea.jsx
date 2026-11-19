import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import TarjetaConexion from './TarjetaConexion';
import OndasMarea from './OndasMarea';
import { conexionesDelRol, esAtajoMarea, primerNombre, subtituloBienvenida } from '../../dominio/marea';

const SELECTOR_ENFOCABLES = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
const movimientoReducido = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;

/**
 * Panel de Marea (ventana modal): cabecera con campana, tema y nueva conversación; columna con las
 * funciones del rol; y la conversación. Esc o Ctrl K lo cierran, Enter envía y el foco queda dentro.
 */
export default function PanelMarea({ usuario, modulo, noLeidas = 0, tema, alCambiarTema, api, alCerrar }) {
  const [mensajes, setMensajes] = useState([]);
  const [foco, setFoco] = useState(null);
  const [conexionActiva, setConexionActiva] = useState(null);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const refPanel = useRef(null);
  const refEntrada = useRef(null);
  const refConversacion = useRef(null);
  const refCerrar = useRef(null);

  const conexiones = conexionesDelRol(usuario.rol);
  const subtitulo = useMemo(() => subtituloBienvenida(noLeidas), [noLeidas]);

  const cerrar = () => {
    if (cerrando) return;
    setCerrando(true);
    setTimeout(alCerrar, movimientoReducido() ? 0 : 190);
  };
  refCerrar.current = cerrar;

  // Foco atrapado en el panel, Esc / Ctrl K cierran y, al cerrar, el foco vuelve a la barra.
  useEffect(() => {
    const enfocadoAntes = document.activeElement;
    document.body.classList.add('marea-abierta');
    refEntrada.current?.focus();
    const alPresionarTecla = (evento) => {
      if (evento.key === 'Escape' || esAtajoMarea(evento)) {
        evento.preventDefault();
        refCerrar.current();
        return;
      }
      if (evento.key !== 'Tab' || !refPanel.current) return;
      const enfocables = [...refPanel.current.querySelectorAll(SELECTOR_ENFOCABLES)];
      if (!enfocables.length) return;
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
      document.body.classList.remove('marea-abierta');
      enfocadoAntes?.focus?.();
    };
  }, []);

  useEffect(() => {
    const caja = refConversacion.current;
    if (caja) caja.scrollTop = caja.scrollHeight;
  }, [mensajes, pensando]);

  /** Envía un mensaje escrito o una acción (función, aviso) y agrega la respuesta de Marea. */
  async function enviar({ mensaje = '', accion = null, etiqueta = '' }) {
    const escrito = mensaje.trim();
    if ((!escrito && !accion) || pensando) return;
    setMensajes((actuales) => [...actuales, { de: 'usuario', texto: escrito || etiqueta }]);
    setTexto('');
    setPensando(true);
    try {
      const respuesta = await api.enviar({ mensaje: escrito, foco, accion });
      setMensajes((actuales) => [...actuales, { de: 'marea', ...respuesta }]);
      setFoco(respuesta.foco ?? null);
    } catch (error) {
      setMensajes((actuales) => [...actuales, { de: 'marea', texto: error.message || 'No pude responder. Intenta de nuevo.' }]);
    } finally {
      setPensando(false);
    }
  }

  const elegirConexion = (conexion) => {
    setConexionActiva(conexion.id);
    enviar({ accion: conexion.accion, etiqueta: conexion.nombre });
  };
  const verAvisos = () => enviar({ accion: { tipo: 'avisos' }, etiqueta: 'Avisos' });
  const nuevaConversacion = () => {
    if (pensando) return;
    setMensajes([]);
    setFoco(null);
    setConexionActiva(null);
    refEntrada.current?.focus();
  };

  return createPortal(
    <div
      className={`marea-capa marea-tema-${tema}${cerrando ? ' marea-cerrando' : ''}`}
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) cerrar();
      }}
    >
      <section ref={refPanel} className="marea-panel" role="dialog" aria-modal="true" aria-labelledby="marea-titulo">
        <OndasMarea tema={tema} />
        <header className="marea-cabecera">
          <span className="marea-orbe" aria-hidden="true" />
          <div className="marea-cab-textos">
            <h2 id="marea-titulo">Marea</h2>
            <span>leyendo: {modulo}</span>
          </div>
          <button
            type="button"
            className="marea-circulo"
            aria-label={noLeidas ? `Avisos, ${noLeidas} sin revisar` : 'Avisos'}
            title="Avisos"
            onClick={verAvisos}
          >
            <i className="bi bi-bell" aria-hidden="true" />
            {noLeidas > 0 && <span className="marea-insignia">{noLeidas}</span>}
          </button>
          <div className="marea-tema" role="group" aria-label="Apariencia de Marea">
            <button type="button" aria-pressed={tema === 'claro'} title="Modo claro" onClick={() => alCambiarTema('claro')}>
              <i className="bi bi-sun" aria-hidden="true" />
              <span>Claro</span>
            </button>
            <button type="button" aria-pressed={tema === 'oscuro'} title="Modo oscuro" onClick={() => alCambiarTema('oscuro')}>
              <i className="bi bi-moon" aria-hidden="true" />
              <span>Oscuro</span>
            </button>
          </div>
          <button type="button" className="marea-circulo" aria-label="Nueva conversación" title="Nueva conversación" onClick={nuevaConversacion}>
            <i className="bi bi-arrow-counterclockwise" aria-hidden="true" />
          </button>
          <button type="button" className="marea-circulo" aria-label="Cerrar Marea (Esc)" onClick={cerrar}>
            <i className="bi bi-x-lg" aria-hidden="true" />
          </button>
        </header>

        <aside className="marea-costado" aria-label="Funciones de Marea">
          <div className="marea-bloque-conexiones">
            <p className="marea-rotulo">Conectada a</p>
            <ul className="marea-conexiones">
              {conexiones.map((conexion) => (
                <li key={conexion.id}>
                  <TarjetaConexion conexion={conexion} activa={conexionActiva === conexion.id} alElegir={elegirConexion} />
                </li>
              ))}
              <li>
                <TarjetaConexion />
              </li>
            </ul>
          </div>
          <div>
            <p className="marea-rotulo">Atajos</p>
            <ul className="marea-atajos">
              <li>
                <span>Abrir o cerrar</span>
                <kbd className="marea-kbd">Ctrl K</kbd>
              </li>
              <li>
                <span>Cerrar</span>
                <kbd className="marea-kbd">Esc</kbd>
              </li>
              <li>
                <span>Enviar</span>
                <kbd className="marea-kbd">Enter</kbd>
              </li>
            </ul>
          </div>
          <p className="marea-privacidad">Solo uso lo que tu rol puede ver. Antes de cambiar algo, te pido confirmación.</p>
        </aside>

        <div className="marea-principal">
          <div ref={refConversacion} className="marea-conversacion" aria-live="polite">
            {mensajes.length === 0 && (
              <div className="marea-bienvenida">
                <h3>
                  Hola, {primerNombre(usuario.nombre)}. Soy <em>Marea</em>, tu agente de reclutamiento.
                </h3>
                {noLeidas > 0 ? (
                  <p>
                    <button type="button" className="marea-enlace" onClick={verAvisos}>
                      {subtitulo}
                    </button>
                  </p>
                ) : (
                  <p>{subtitulo}</p>
                )}
              </div>
            )}
            {mensajes.map((mensaje, indice) =>
              mensaje.de === 'usuario' ? (
                <div key={indice} className="marea-msg-usuario">
                  {mensaje.texto}
                </div>
              ) : (
                <div key={indice} className="marea-msg-agente">
                  <span className="marea-orbe" aria-hidden="true" />
                  <div className="marea-msg-cuerpo">
                    <p>{mensaje.texto}</p>
                  </div>
                </div>
              ),
            )}
            {pensando && (
              <div className="marea-pensando" role="status">
                <i />
                <i />
                <i />
                <span>Marea está pensando…</span>
              </div>
            )}
          </div>
          <form
            className="marea-compositor"
            onSubmit={(evento) => {
              evento.preventDefault();
              enviar({ mensaje: texto });
            }}
          >
            <label htmlFor="marea-entrada" className="visually-hidden">
              Escribe a Marea
            </label>
            <div className="marea-caja">
              <input
                ref={refEntrada}
                id="marea-entrada"
                type="text"
                autoComplete="off"
                maxLength={1000}
                placeholder="Escribe lo que necesitas…"
                value={texto}
                onChange={(evento) => setTexto(evento.target.value)}
              />
              <button type="submit" className="marea-enviar" aria-label="Enviar" disabled={!texto.trim() || pensando}>
                <i className="bi bi-arrow-right" aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>,
    document.body,
  );
}
