import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../datos/AuthContext';
import { useDatos } from '../../datos/DatosContext';
import { apiAgente } from '../../servicios/apiAgente';
import { obtenerToken } from '../../servicios/api';
import { suscribirTiempoReal } from '../../servicios/tiempoReal';
import { esAtajoMarea, guardarTema, leerTema, nombreModulo } from '../../dominio/marea';
import PanelMarea from './PanelMarea';
import './marea.css';

/**
 * Barra flotante de Marea, arriba al centro de todas las pantallas internas. Muestra el módulo que se
 * está viendo y los avisos nuevos; con un clic o Ctrl K abre el panel.
 * Marea necesita el backend (modo api): en modo local (GitHub Pages sin servidor) no se muestra.
 */
export default function BarraMarea({ api = apiAgente }) {
  const { usuarioActual } = useAuth();
  const { modo } = useDatos();
  const { pathname } = useLocation();
  const [abierto, setAbierto] = useState(false);
  const [noLeidas, setNoLeidas] = useState(0);
  const [tema, setTema] = useState(leerTema);
  const refLanzador = useRef(null);
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

  if (!disponible) return null;

  const modulo = nombreModulo(pathname);
  const cambiarTema = (nuevo) => {
    setTema(nuevo);
    guardarTema(nuevo);
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
        className={`marea-lanzador marea-tema-${tema}${abierto ? ' marea-oculto' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-label={`Abrir Marea, tu agente de reclutamiento${noLeidas ? `. ${noLeidas} avisos nuevos` : ''} (Ctrl K)`}
        onClick={() => setAbierto(true)}
      >
        <span className="marea-orbe" aria-hidden="true" />
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
        />
      )}
    </div>
  );
}
