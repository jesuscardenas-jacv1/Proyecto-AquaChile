import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDatos } from '../datos/DatosContext';
import { useAuth } from '../datos/AuthContext';
import { ESTADOS_POSTULACION } from '../datos/demoPostulaciones';
import { filtrarPostulaciones, resumenPostulaciones } from '../dominio/postulaciones';
import { formatearFecha } from '../dominio/formateo';
import EstadoVacio from '../componentes/comunes/EstadoVacio';
import Mensaje from '../componentes/comunes/Mensaje';
import VentanaPostulante from '../componentes/portal/VentanaPostulante';

const COLOR_ESTADO = {
  Recibida: 'bg-secondary-subtle text-secondary-emphasis',
  'En evaluación': 'bg-primary-subtle text-primary-emphasis',
  Descartada: 'bg-danger-subtle text-danger-emphasis',
};

/**
 * Bandeja de postulaciones del portal "Trabaja con nosotros".
 * El analista elige a quién pasar a evaluación psicolaboral (abre el formulario de
 * solicitud ya completado) o descarta la postulación. La jefatura solo consulta.
 * Un clic en el postulante abre una ventana con su detalle y su CV.
 */
export default function Postulaciones() {
  const { postulaciones, ofertas, candidatos, actualizarPostulacion, modo } = useDatos();
  const { soloLectura } = useAuth();
  const navegar = useNavigate();
  const [criterios, setCriterios] = useState({ estado: 'Recibida', ofertaId: '', busqueda: '' });
  const [mensaje, setMensaje] = useState(null);
  const [idDetalle, setIdDetalle] = useState(null);

  const resumen = resumenPostulaciones(postulaciones);
  const visibles = filtrarPostulaciones(postulaciones, { ofertas, candidatos }, criterios);
  // Se busca entre todas (no solo las visibles) para que la ventana siga abierta si cambia el filtro.
  const detalle = idDetalle
    ? filtrarPostulaciones(postulaciones, { ofertas, candidatos }, {}).find((p) => p.id === idDetalle)
    : null;
  const cambiar = (campo, valor) => setCriterios((actual) => ({ ...actual, [campo]: valor }));

  const pasarAEvaluacion = (postulacion) => navegar(`/solicitudes/nueva?postulacion=${postulacion.id}`);

  const cambiarEstado = async (postulacion, estado) => {
    if (!(await actualizarPostulacion(postulacion.id, { estado }))) return;
    setIdDetalle(null);
    setMensaje(
      estado === 'Descartada'
        ? `Se descartó la postulación de ${postulacion.candidato?.nombre}.`
        : `La postulación de ${postulacion.candidato?.nombre} volvió a Recibidas.`,
    );
  };

  return (
    <div className="d-flex flex-column gap-3">
      <header className="d-flex flex-column flex-md-row justify-content-between gap-2 align-items-md-center">
        <div>
          <h1 className="h4 mb-1">Postulaciones</h1>
          <p className="text-secondary mb-0">
            Postulantes del portal "Trabaja con nosotros". Selecciona a quién pasar a evaluación psicolaboral.
          </p>
        </div>
        <Link to="/trabaja-con-nosotros" target="_blank" rel="noreferrer" className="btn btn-outline-primary btn-sm align-self-start">
          <i className="bi bi-box-arrow-up-right me-1" aria-hidden="true" />
          Ver portal público
        </Link>
      </header>

      {mensaje ? (
        <Mensaje tipo="success" alCerrar={() => setMensaje(null)}>
          {mensaje}
        </Mensaje>
      ) : null}

      <ul className="nav nav-pills gap-1" aria-label="Estado de la postulación">
        {[['', 'Todas', postulaciones.length], ...ESTADOS_POSTULACION.map((estado) => [estado, estado, resumen[estado]])].map(
          ([valor, etiqueta, total]) => (
            <li key={etiqueta} className="nav-item">
              <button
                type="button"
                className={`nav-link py-1 ${criterios.estado === valor ? 'active' : ''}`}
                aria-pressed={criterios.estado === valor}
                onClick={() => cambiar('estado', valor)}
              >
                {etiqueta} <span className="badge bg-light text-dark ms-1">{total}</span>
              </button>
            </li>
          ),
        )}
      </ul>

      <section className="card border-0 shadow-sm">
        <div className="card-header bg-white row g-2 mx-0">
          <div className="col-12 col-md-7 ps-0">
            <label className="visually-hidden" htmlFor="buscar-postulacion">
              Buscar postulante
            </label>
            <input
              id="buscar-postulacion"
              type="search"
              className="form-control form-control-sm"
              placeholder="Buscar por nombre, correo u oferta"
              value={criterios.busqueda}
              onChange={(evento) => cambiar('busqueda', evento.target.value)}
            />
          </div>
          <div className="col-12 col-md-5 pe-0">
            <label className="visually-hidden" htmlFor="filtro-oferta">
              Oferta
            </label>
            <select
              id="filtro-oferta"
              className="form-select form-select-sm"
              value={criterios.ofertaId}
              onChange={(evento) => cambiar('ofertaId', evento.target.value)}
            >
              <option value="">Todas las ofertas</option>
              {ofertas.map((oferta) => (
                <option key={oferta.id} value={oferta.id}>
                  {oferta.titulo}
                </option>
              ))}
            </select>
          </div>
        </div>

        {visibles.length === 0 ? (
          <EstadoVacio
            titulo="Sin postulaciones"
            descripcion="No hay postulaciones que coincidan con los filtros."
            icono="bi-person-lines-fill"
          />
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th scope="col">Postulante</th>
                  <th scope="col">Oferta</th>
                  <th scope="col" className="d-none d-lg-table-cell">
                    Fecha
                  </th>
                  <th scope="col" className="d-none d-lg-table-cell">
                    CV
                  </th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="text-end">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((postulacion) => (
                  <tr
                    key={postulacion.id}
                    className="fila-clicable"
                    onClick={(evento) => {
                      // Los botones y enlaces de la fila hacen su propia acción.
                      if (!evento.target.closest('button, a')) setIdDetalle(postulacion.id);
                    }}
                  >
                    <td>
                      <button
                        type="button"
                        className="btn btn-link p-0 fw-semibold text-start text-decoration-none d-block"
                        aria-label={`Ver detalle de ${postulacion.candidato?.nombre ?? 'postulante eliminado'}`}
                        onClick={() => setIdDetalle(postulacion.id)}
                      >
                        {postulacion.candidato?.nombre ?? 'Postulante eliminado'}
                      </button>
                      <small className="text-secondary">
                        {postulacion.candidato?.correo} · {postulacion.ciudad}
                      </small>
                    </td>
                    <td>
                      <span className="d-block">{postulacion.oferta?.titulo ?? '—'}</span>
                      <small className="text-secondary">{postulacion.oferta?.ubicacion}</small>
                    </td>
                    <td className="d-none d-lg-table-cell">{formatearFecha(postulacion.fechaPostulacion)}</td>
                    <td className="d-none d-lg-table-cell small text-break">{postulacion.cvNombre || '—'}</td>
                    <td>
                      <span className={`badge ${COLOR_ESTADO[postulacion.estado]}`}>{postulacion.estado}</span>
                    </td>
                    <td className="text-end">
                      {postulacion.estado === 'En evaluación' && postulacion.solicitudId ? (
                        <Link to={`/solicitudes/${postulacion.solicitudId}`} className="btn btn-sm btn-link">
                          Ver solicitud #{postulacion.solicitudId}
                        </Link>
                      ) : null}
                      {!soloLectura && postulacion.estado === 'Recibida' ? (
                        <div className="btn-group btn-group-sm">
                          <button
                            type="button"
                            className="btn btn-primary"
                            aria-label={`Pasar a evaluación a ${postulacion.candidato?.nombre}`}
                            onClick={() => pasarAEvaluacion(postulacion)}
                          >
                            Pasar a evaluación
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-danger"
                            aria-label={`Descartar a ${postulacion.candidato?.nombre}`}
                            onClick={() => cambiarEstado(postulacion, 'Descartada')}
                          >
                            Descartar
                          </button>
                        </div>
                      ) : null}
                      {!soloLectura && postulacion.estado === 'Descartada' ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          aria-label={`Reactivar a ${postulacion.candidato?.nombre}`}
                          onClick={() => cambiarEstado(postulacion, 'Recibida')}
                        >
                          Reactivar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detalle ? (
        <VentanaPostulante
          postulacion={detalle}
          colorEstado={COLOR_ESTADO[detalle.estado]}
          soloLectura={soloLectura}
          conServidor={modo === 'api'}
          alPasarAEvaluacion={pasarAEvaluacion}
          alCambiarEstado={cambiarEstado}
          alCerrar={() => setIdDetalle(null)}
        />
      ) : null}
    </div>
  );
}
