import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../datos/AuthContext';
import { useDatos } from '../datos/DatosContext';
import { descriptorDeOferta } from '../datos/catalogos';
import {
  contarPostulacionesPorOferta,
  ESTADOS_OFERTA,
  filtrarGestionOfertas,
  validarOferta,
} from '../dominio/ofertas';
import { formatearFecha } from '../dominio/formateo';
import { hayErrores } from '../dominio/validaciones';
import EstadoVacio from '../componentes/comunes/EstadoVacio';
import Mensaje from '../componentes/comunes/Mensaje';

const ETIQUETA_ESTADO = { Borrador: 'Borrador', Abierta: 'Publicada', Cerrada: 'Cerrada' };
const COLOR_ESTADO = {
  Borrador: 'bg-secondary-subtle text-secondary-emphasis',
  Abierta: 'bg-success-subtle text-success-emphasis',
  Cerrada: 'bg-danger-subtle text-danger-emphasis',
};

/**
 * Ofertas de empleo del portal "Trabaja con nosotros": el analista las crea, edita,
 * publica, cierra y reabre; la jefatura solo consulta.
 */
export default function Ofertas() {
  const { ofertas, postulaciones, cambiarEstadoOferta } = useDatos();
  const { soloLectura } = useAuth();
  const { state } = useLocation();
  const [criterios, setCriterios] = useState({ estado: '', busqueda: '' });
  const [aviso, setAviso] = useState(state?.mensaje ? { tipo: state.tipo ?? 'success', texto: state.mensaje } : null);

  const visibles = filtrarGestionOfertas(ofertas, criterios);
  const cuentas = contarPostulacionesPorOferta(postulaciones);
  const cambiar = (campo, valor) => setCriterios((actual) => ({ ...actual, [campo]: valor }));

  const cambiarEstado = async (oferta, estado, texto) => {
    if (oferta.estado === 'Borrador' && hayErrores(validarOferta(oferta, { completa: true }))) {
      setAviso({ tipo: 'warning', texto: `Completa "${oferta.titulo}" antes de publicarla: usa Editar.` });
      return;
    }
    if (oferta.estado === 'Borrador' && !descriptorDeOferta(oferta)) {
      setAviso({ tipo: 'warning', texto: `Sube el descriptor de "${oferta.titulo}" antes de publicarla: usa Editar.` });
      return;
    }
    if (await cambiarEstadoOferta(oferta.id, estado)) setAviso({ tipo: 'success', texto });
  };

  return (
    <div className="d-flex flex-column gap-3">
      <header className="d-flex flex-column flex-md-row justify-content-between gap-2 align-items-md-center">
        <div>
          <h1 className="h4 mb-1">Ofertas de empleo</h1>
          <p className="text-secondary mb-0">Lo que se publica aquí aparece en el portal "Trabaja con nosotros".</p>
        </div>
        <div className="d-flex flex-wrap gap-2 align-self-start">
          <Link to="/trabaja-con-nosotros" target="_blank" rel="noreferrer" className="btn btn-outline-primary btn-sm">
            <i className="bi bi-box-arrow-up-right me-1" aria-hidden="true" />
            Ver portal público
          </Link>
          {!soloLectura ? (
            <Link to="/ofertas/nueva" className="btn btn-primary btn-sm">
              <i className="bi bi-plus-circle me-1" aria-hidden="true" />
              Nueva oferta
            </Link>
          ) : null}
        </div>
      </header>

      {aviso ? (
        <Mensaje tipo={aviso.tipo} alCerrar={() => setAviso(null)}>
          {aviso.texto}
        </Mensaje>
      ) : null}

      <section className="card border-0 shadow-sm" aria-label="Filtros de ofertas">
        <div className="card-body row g-2">
          <div className="col-12 col-md-8">
            <label className="visually-hidden" htmlFor="ofertas-busqueda">
              Buscar ofertas
            </label>
            <input
              id="ofertas-busqueda"
              type="search"
              className="form-control"
              placeholder="Buscar por título, cargo, área o ubicación"
              value={criterios.busqueda}
              onChange={(evento) => cambiar('busqueda', evento.target.value)}
            />
          </div>
          <div className="col-12 col-md-4">
            <label className="visually-hidden" htmlFor="ofertas-estado">
              Estado
            </label>
            <select
              id="ofertas-estado"
              className="form-select"
              value={criterios.estado}
              onChange={(evento) => cambiar('estado', evento.target.value)}
            >
              <option value="">Todos los estados</option>
              {ESTADOS_OFERTA.map((estado) => (
                <option key={estado} value={estado}>
                  {ETIQUETA_ESTADO[estado]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {visibles.length === 0 ? (
        <section className="card border-0 shadow-sm">
          <EstadoVacio
            titulo="Sin ofertas"
            descripcion="No hay ofertas que coincidan con los filtros."
            icono="bi-megaphone"
          />
        </section>
      ) : (
        <section className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th scope="col">Oferta</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Publicada</th>
                  <th scope="col" className="text-end">
                    Postulantes
                  </th>
                  {!soloLectura ? (
                    <th scope="col" className="text-end">
                      Acciones
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {visibles.map((oferta) => (
                  <tr key={oferta.id}>
                    <td>
                      <div className="fw-semibold">{oferta.titulo}</div>
                      <small className="text-secondary">
                        {[oferta.area, oferta.ubicacion, oferta.region].filter(Boolean).join(' · ') || 'Sin completar'}
                      </small>
                      <small className="d-block text-secondary text-break">
                        <i className="bi bi-file-earmark-text me-1" aria-hidden="true" />
                        {descriptorDeOferta(oferta) || 'Sin descriptor'}
                      </small>
                    </td>
                    <td>
                      <span className={`badge ${COLOR_ESTADO[oferta.estado]}`}>{ETIQUETA_ESTADO[oferta.estado]}</span>
                    </td>
                    <td className="text-nowrap">{oferta.fechaPublicacion ? formatearFecha(oferta.fechaPublicacion) : '—'}</td>
                    <td className="text-end">{cuentas[oferta.id] ?? 0}</td>
                    {!soloLectura ? (
                      <td className="text-end">
                        <div className="d-inline-flex flex-wrap justify-content-end gap-1">
                          <Link
                            to={`/ofertas/${oferta.id}/editar`}
                            className="btn btn-sm btn-outline-primary"
                            aria-label={`Editar ${oferta.titulo}`}
                          >
                            Editar
                          </Link>
                          {oferta.estado === 'Borrador' ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              aria-label={`Publicar ${oferta.titulo}`}
                              onClick={() => cambiarEstado(oferta, 'Abierta', `Se publicó "${oferta.titulo}".`)}
                            >
                              Publicar
                            </button>
                          ) : null}
                          {oferta.estado === 'Abierta' ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              aria-label={`Cerrar ${oferta.titulo}`}
                              onClick={() =>
                                cambiarEstado(oferta, 'Cerrada', `"${oferta.titulo}" ya no recibe postulaciones.`)
                              }
                            >
                              Cerrar
                            </button>
                          ) : null}
                          {oferta.estado === 'Cerrada' ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              aria-label={`Reabrir ${oferta.titulo}`}
                              onClick={() => cambiarEstado(oferta, 'Abierta', `Se reabrió "${oferta.titulo}".`)}
                            >
                              Reabrir
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
