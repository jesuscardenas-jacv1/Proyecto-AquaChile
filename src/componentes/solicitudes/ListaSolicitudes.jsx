import { useState } from 'react';
import { ESTADOS_SOLICITUD, FAMILIAS_CARGO } from '../../datos/constantes';
import { filtrarSolicitudes } from '../../dominio/consultas';
import { formatearFecha } from '../../dominio/formateo';
import EstadoVacio from '../comunes/EstadoVacio';
import EtiquetaEstado from '../comunes/EtiquetaEstado';

/**
 * Listado de solicitudes con búsqueda por texto y filtros por estado y familia.
 */
export default function ListaSolicitudes({
  solicitudes = [],
  candidatos = [],
  alAbrir,
  estadoInicial = '',
}) {
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState(estadoInicial);
  const [familiaCargo, setFamiliaCargo] = useState('');

  const visibles = filtrarSolicitudes(solicitudes, { texto, estado, familiaCargo }, candidatos);
  const nombreCandidato = (id) => candidatos.find((c) => c.id === Number(id))?.nombre ?? 'Sin candidato';

  const limpiarFiltros = () => {
    setTexto('');
    setEstado('');
    setFamiliaCargo('');
  };

  return (
    <section className="card border-0 shadow-sm">
      <div className="card-header bg-white">
        <h2 className="h5 mb-3">Solicitudes de evaluación</h2>
        <div className="row g-2">
          <div className="col-12 col-lg-5">
            <label className="form-label small mb-1" htmlFor="buscar-solicitud">
              Buscar
            </label>
            <input
              id="buscar-solicitud"
              type="search"
              className="form-control form-control-sm"
              placeholder="Candidato, cargo o profesional"
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
            />
          </div>
          <div className="col-6 col-lg-3">
            <label className="form-label small mb-1" htmlFor="filtro-estado">
              Estado
            </label>
            <select
              id="filtro-estado"
              className="form-select form-select-sm"
              value={estado}
              onChange={(evento) => setEstado(evento.target.value)}
            >
              <option value="">Todos</option>
              {ESTADOS_SOLICITUD.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-lg-3">
            <label className="form-label small mb-1" htmlFor="filtro-familia">
              Familia
            </label>
            <select
              id="filtro-familia"
              className="form-select form-select-sm"
              value={familiaCargo}
              onChange={(evento) => setFamiliaCargo(evento.target.value)}
            >
              <option value="">Todas</option>
              {FAMILIAS_CARGO.map((familia) => (
                <option key={familia} value={familia}>
                  {familia}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-lg-1 d-flex align-items-end">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary w-100"
              onClick={limpiarFiltros}
            >
              Limpiar
            </button>
          </div>
        </div>
        <small className="text-secondary d-block mt-2">
          Mostrando {visibles.length} de {solicitudes.length} solicitudes
        </small>
      </div>

      {visibles.length === 0 ? (
        <EstadoVacio
          titulo="Sin solicitudes"
          descripcion="No hay solicitudes que coincidan con los filtros aplicados."
          textoBoton="Limpiar filtros"
          alAccion={limpiarFiltros}
          icono="bi-file-earmark-text"
        />
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th scope="col">#</th>
                <th scope="col">Candidato</th>
                <th scope="col">Cargo</th>
                <th scope="col">Familia</th>
                <th scope="col">Fecha</th>
                <th scope="col">Estado</th>
                <th scope="col">Profesional</th>
                <th scope="col" className="text-end">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((solicitud) => (
                <tr key={solicitud.id}>
                  <td>{solicitud.id}</td>
                  <td className="fw-semibold">{nombreCandidato(solicitud.candidatoId)}</td>
                  <td>{solicitud.cargo}</td>
                  <td>{solicitud.familiaCargo}</td>
                  <td>{formatearFecha(solicitud.fechaSolicitud)}</td>
                  <td>
                    <EtiquetaEstado valor={solicitud.estado} />
                  </td>
                  <td>{solicitud.profesionalResponsable || 'Sin asignar'}</td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => alAbrir(solicitud)}
                    >
                      Gestionar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
