import { useCallback, useEffect, useState } from 'react';
import { apiAdmin } from '../../servicios/api';
import { formatearNumero } from '../../dominio/usoIa';
import Mensaje from '../comunes/Mensaje';

const ESTADO_GEMINI = {
  disponible: 'Gemini está activo: Marea entiende frases libres y los CV nuevos se leen solos.',
  tope: 'Gemini se apagó al llegar al tope de gasto. Marea sigue respondiendo con su intérprete local.',
  sinClave: 'Gemini no está configurado en el servidor. Marea funciona con su intérprete local y los CV nuevos esperan en la cola.',
};

function estadoGemini({ configurado, disponible }) {
  if (disponible) return ESTADO_GEMINI.disponible;
  return configurado ? ESTADO_GEMINI.tope : ESTADO_GEMINI.sinClave;
}

function Dato({ titulo, valor, detalle }) {
  return (
    <div className="col-6 col-lg-3">
      <div className="border rounded p-2 h-100">
        <div className="small text-secondary">{titulo}</div>
        <div className="h5 mb-0">{formatearNumero(valor)}</div>
        {detalle ? <div className="small text-secondary">{detalle}</div> : null}
      </div>
    </div>
  );
}

/**
 * Base de conocimiento de Marea para el administrador: cuántos CV están leídos, los que faltan, las
 * habilidades que conviene sumar al catálogo y el botón para procesar lo pendiente.
 */
export default function BaseConocimiento({ api = apiAdmin }) {
  const [datos, setDatos] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await api.conocimiento());
    } catch (excepcion) {
      setMensaje({ tipo: 'danger', texto: excepcion.message });
    }
  }, [api]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const procesar = async () => {
    setProcesando(true);
    setMensaje(null);
    try {
      const { encolados, conocimiento } = await api.procesarConocimiento();
      setDatos(conocimiento);
      setMensaje(
        encolados
          ? { tipo: 'success', texto: `${encolados} ${encolados === 1 ? 'CV quedó' : 'CV quedaron'} en la cola de lectura.` }
          : { tipo: 'info', texto: 'No hay CV nuevos por encolar.' },
      );
    } catch (excepcion) {
      setMensaje({ tipo: 'danger', texto: excepcion.message });
    } finally {
      setProcesando(false);
    }
  };

  return (
    <section className="card border-0 shadow-sm" aria-labelledby="titulo-conocimiento">
      <div className="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h2 id="titulo-conocimiento" className="h6 mb-0">
            <i className="bi bi-person-vcard me-1" aria-hidden="true" />
            Base de conocimiento
          </h2>
          <small className="text-secondary">Perfiles que Marea usa para buscar candidatos por ciudad, habilidades y experiencia.</small>
        </div>
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={procesar} disabled={procesando || !datos || datos.sinPerfil === 0}>
          Leer CV pendientes
        </button>
      </div>
      <div className="card-body d-flex flex-column gap-3">
        {mensaje ? (
          <Mensaje tipo={mensaje.tipo} alCerrar={() => setMensaje(null)}>
            {mensaje.texto}
          </Mensaje>
        ) : null}
        {datos ? (
          <>
            <p className="small mb-0">{estadoGemini(datos.gemini)}</p>
            <div className="row g-2">
              <Dato titulo="Perfiles listos" valor={datos.perfiles} detalle={`${formatearNumero(datos.habilidades)} habilidades distintas`} />
              <Dato titulo="CV sin leer" valor={datos.sinPerfil} />
              <Dato titulo="En la cola" valor={datos.cola.pendientes} detalle={datos.cola.errores ? `${datos.cola.errores} con error` : null} />
              <Dato titulo="Eventos registrados" valor={datos.eventos} />
            </div>
            {datos.errores.length ? (
              <div>
                <h3 className="h6 small text-secondary mb-1">CV que no se pudieron leer</h3>
                <ul className="small mb-0 ps-3">
                  {datos.errores.map((e) => (
                    <li key={e.motivo}>
                      {e.motivo} ({e.total})
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {datos.fueraDeCatalogo.length ? (
              <div>
                <h3 className="h6 small text-secondary mb-1">Habilidades por sumar al catálogo</h3>
                <p className="small mb-0">{datos.fueraDeCatalogo.map((h) => `${h.habilidad} (${h.total})`).join(', ')}</p>
              </div>
            ) : null}
          </>
        ) : (
          <p className="small text-secondary mb-0" role="status">
            Cargando la base de conocimiento…
          </p>
        )}
      </div>
    </section>
  );
}
