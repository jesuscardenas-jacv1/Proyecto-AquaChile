import { useEffect, useState } from 'react';
import { tiempoTranscurrido } from '../../dominio/formateo';

/** Lista de avisos con sus acciones («Analizar y agendar», «Resumen»). */
export function ListaAvisos({ avisos, alUsar, desactivado = false }) {
  if (!avisos.length) return <p className="marea-vacio">No tienes avisos.</p>;
  return (
    <ul className="marea-avisos">
      {avisos.map((aviso) => (
        <li key={aviso.id} className={`marea-notif${aviso.leida ? ' marea-leida' : ''}`}>
          <i aria-hidden="true" />
          <div>
            <b>{aviso.mensaje}</b>
            {aviso.creadaEn && <time>{tiempoTranscurrido(aviso.creadaEn)}</time>}
            {aviso.acciones.length > 0 && (
              <div className="marea-acciones">
                {aviso.acciones.map((opcion, indice) => (
                  <button
                    key={opcion.etiqueta}
                    type="button"
                    className={indice === 0 ? 'marea-boton-principal' : 'marea-boton-secundario'}
                    disabled={desactivado}
                    onClick={() => alUsar(aviso, opcion)}
                  >
                    {opcion.etiqueta}
                  </button>
                ))}
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Ventana de avisos de la campana de Marea (bajo la cabecera del panel): solicitudes nuevas,
 * asignaciones y postulaciones. `alUsar(aviso, opcion)` marca el aviso y se lo pide a Marea.
 */
export default function CampanaMarea({ api, alUsar, alCambiar }) {
  const [avisos, setAvisos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .avisos()
      .then((datos) => setAvisos(datos.avisos ?? []))
      .catch((e) => setError(e.message || 'No se pudieron cargar los avisos.'));
  }, [api]);

  const marcarTodos = async () => {
    await api.marcarTodos().catch(() => {});
    setAvisos((actuales) => actuales.map((aviso) => ({ ...aviso, leida: true })));
    alCambiar();
  };

  return (
    <div className="marea-avisos-pop" role="region" aria-label="Avisos recientes">
      <header>
        <strong>Avisos</strong>
        {avisos?.some((aviso) => !aviso.leida) && (
          <button type="button" onClick={marcarTodos}>
            Marcar todo como leído
          </button>
        )}
      </header>
      {error && <p className="marea-error">{error}</p>}
      {!avisos && !error && <p className="marea-vacio">Cargando avisos…</p>}
      {avisos && <ListaAvisos avisos={avisos} alUsar={alUsar} />}
    </div>
  );
}
