import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../datos/AuthContext';
import { useDatos } from '../../datos/DatosContext';
import { apiAgente } from '../../servicios/apiAgente';
import { obtenerToken } from '../../servicios/api';
import { suscribirTiempoReal } from '../../servicios/tiempoReal';
import { esAtajoMarea, guardarTema, leerTema, minimizarAlDesplazar, nombreModulo } from '../../dominio/marea';
import PanelMarea from './PanelMarea';
import LogoMarea from './LogoMarea';
import AvisoEsquina from './AvisoEsquina';
import './marea.css';

/**
 * Barra flotante de Marea, arriba al centro de todas las pantallas internas. Muestra el módulo que se
 * está viendo y los avisos nuevos; con un clic o Ctrl K abre el panel.
 * Marea necesita el backend (modo api): en modo local (GitHub Pages sin servidor) no se muestra.
 */
export default function BarraMarea({ api = apiAgente }) {
  const { usuarioActual } = useAuth();
  const { modo, refrescar } = useDatos();
  const { pathname } = useLocation();
  const [abierto, setAbierto] = useState(false);
  const [noLeidas, setNoLeidas] = useState(0);
  const [tema, setTema] = useState(leerTema);
  const [aviso, setAviso] = useState('');
  const [minimizada, setMinimizada] = useState(false);
  const refLanzador = useRef(null);
  const cerrarAviso = useCallback(() => setAviso(''), []);
  const disponible = modo === 'api' && Boolean(usuarioActual) && Boolean(obtenerToken());

  const cargarAvisos = useCallback(async () => {
    try {
      setNoLeidas((await api.avisos()).noLeidas ?? 0);
    } catch {
      // Sin avisos no se muestra la insignia; Marea sigue disponible.
    }
  }, [api]);

  useEffect(() => {
    if (!disponible) return undefined;
    cargarAvisos();
    // Un aviso nuevo por tiempo real actualiza la insignia al instante.
    return suscribirTiempoReal('notificacion', cargarAvisos);
  }, [disponible, cargarAvisos]);

  // Ctrl K abre Marea desde cualquier pantalla (con el panel abierto, lo cierra el panel).
  useEffect(() => {
    if (!disponible || abierto) return undefined;
    const alPresionarTecla = (evento) => {
      if (!esAtajoMarea(evento)) return;
      evento.preventDefault();
      setAbierto(true);
    };
    document.addEventListener('keydown', alPresionarTecla);
    return () => document.removeEventListener('keydown', alPresionarTecla);
  }, [disponible, abierto]);

  // Al bajar con la rueda (en la página o en una lista) la barra se minimiza para no estorbar.
  // Se escucha en captura porque el evento scroll no sube desde las listas internas.
  useEffect(() => {
    if (!disponible) return undefined;
    const posiciones = new WeakMap();
    const alDesplazar = (evento) => {
      const elemento = evento.target === document ? document.scrollingElement : evento.target;
      if (!elemento || elemento.closest?.('.marea-capa')) return;
      const y = elemento.scrollTop;
      const anterior = posiciones.get(elemento) ?? 0;
      posiciones.set(elemento, y);
      const esPagina = elemento === document.scrollingElement;
      setMinimizada((actual) => minimizarAlDesplazar({ y, anterior, minimizada: actual, esPagina }));
    };
    document.addEventListener('scroll', alDesplazar, { capture: true, passive: true });
    return () => document.removeEventListener('scroll', alDesplazar, { capture: true });
  }, [disponible]);

  if (!disponible) return null;

  const modulo = nombreModulo(pathname);
  const cambiarTema = (nuevo) => {
    setTema(nuevo);
    guardarTema(nuevo);
  };
  // Al agendar desde Marea: aviso en la esquina y datos al día en el Planner y demás pantallas.
  const agendado = (texto) => {
    setAviso(texto);
    refrescar?.();
  };
  const cerrar = () => {
    setAbierto(false);
    cargarAvisos();
    // Al cerrar, el foco vuelve a la barra (también si se abrió con Ctrl K).
    setTimeout(() => refLanzador.current?.focus(), 0);
  };

  return (
    <div className="marea-zona">
      <button
        ref={refLanzador}
        type="button"
        className={`marea-lanzador marea-tema-${tema}${abierto ? ' marea-oculto' : ''}${minimizada ? ' marea-mini' : ''}`}
        aria-haspopup={minimizada ? undefined : 'dialog'}
        aria-expanded={minimizada ? undefined : abierto}
        aria-label={
          minimizada
            ? `Mostrar Marea${noLeidas ? `. ${noLeidas} avisos nuevos` : ''}`
            : `Abrir Marea, tu agente de reclutamiento${noLeidas ? `. ${noLeidas} avisos nuevos` : ''} (Ctrl K)`
        }
        // Minimizada, el primer clic solo la vuelve a mostrar; el siguiente abre el panel.
        onClick={() => (minimizada ? setMinimizada(false) : setAbierto(true))}
      >
        <LogoMarea tamano={34} />
        {minimizada && noLeidas > 0 && <span className="marea-punto-avisos" aria-hidden="true" />}
        <span className="marea-lanzador-textos">
          <span className="marea-lanzador-nombre">Marea</span>
          <span className="marea-lanzador-sub">Pregúntame o pídeme ayuda con {modulo}</span>
        </span>
        {noLeidas > 0 && (
          <span className="marea-nuevos">
            <i className="bi bi-bell" aria-hidden="true" />
            <b>{noLeidas}</b>
            <span>{noLeidas === 1 ? 'nuevo' : 'nuevos'}</span>
          </span>
        )}
        <span className="marea-estado">
          <span className="marea-punto" aria-hidden="true" />
          {modulo}
        </span>
        <kbd className="marea-kbd">Ctrl K</kbd>
      </button>
      {abierto && (
        <PanelMarea
          usuario={usuarioActual}
          modulo={modulo}
          noLeidas={noLeidas}
          tema={tema}
          alCambiarTema={cambiarTema}
          api={api}
          alCerrar={cerrar}
          alCambiarAvisos={cargarAvisos}
          alAgendar={agendado}
        />
      )}
      {aviso && <AvisoEsquina texto={aviso} alCerrar={cerrarAviso} />}
    </div>
  );
}
