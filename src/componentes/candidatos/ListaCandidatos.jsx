import { useState } from 'react';
import { Link } from 'react-router-dom';
import { filtrarCandidatos } from '../../dominio/consultas';
import EstadoVacio from '../comunes/EstadoVacio';

/**
 * Listado de candidatos con buscador.
 * En pantallas grandes muestra tabla y en pantallas pequeñas tarjetas.
 * El nombre lleva a la ficha del candidato; editar, eliminar y registrar solo
 * aparecen si se entregan sus acciones (perfil analista).
 */
export default function ListaCandidatos({
  candidatos = [],
  alEditar,
  alEliminar,
  mostrarNuevo = true,
}) {
  const [busqueda, setBusqueda] = useState('');
  const visibles = filtrarCandidatos(candidatos, busqueda);

  return (
    <section className="card border-0 shadow-sm">
      <div className="card-header bg-white d-flex flex-column flex-md-row gap-2 justify-content-between align-items-md-center">
        <div>
          <h2 className="h5 mb-0">Candidatos</h2>
          <small className="text-secondary">
            {visibles.length} de {candidatos.length} registrados
          </small>
        </div>
        <div className="input-group input-group-sm" style={{ maxWidth: '18rem' }}>
          <span className="input-group-text">
            <i className="bi bi-search" aria-hidden="true" />
          </span>
          <label className="visually-hidden" htmlFor="buscar-candidato">
            Buscar candidato
          </label>
          <input
            id="buscar-candidato"
            type="search"
            className="form-control"
            placeholder="Buscar por nombre, correo o cargo"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
          />
        </div>
      </div>

      {visibles.length === 0 ? (
        <EstadoVacio
          titulo="Sin candidatos"
          descripcion={
            candidatos.length === 0
              ? 'Aún no hay candidatos registrados en el sistema.'
              : 'Ningún candidato coincide con la búsqueda ingresada.'
          }
          textoBoton={candidatos.length === 0 ? 'Registrar candidato' : undefined}
          alAccion={() => setBusqueda('')}
          icono="bi-people"
        />
      ) : (
        <>
          <div className="table-responsive d-none d-md-block">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Nombre</th>
                  <th scope="col">Correo</th>
                  <th scope="col">Teléfono</th>
                  <th scope="col">Cargo</th>
                  <th scope="col">Familia</th>
                  <th scope="col" className="text-end">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((candidato) => (
                  <tr key={candidato.id}>
                    <td>{candidato.id}</td>
                    <td className="fw-semibold">
                      <Link to={`/candidatos/${candidato.id}`}>{candidato.nombre}</Link>
                    </td>
                    <td>{candidato.correo}</td>
                    <td>{candidato.telefono}</td>
                    <td>{candidato.cargo}</td>
                    <td>{candidato.familiaCargo}</td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <Link
                          to={`/candidatos/${candidato.id}`}
                          className="btn btn-outline-primary"
                          aria-label={`Ver ficha de ${candidato.nombre}`}
                        >
                          <i className="bi bi-folder2-open me-1" aria-hidden="true" />
                          Ver ficha
                        </Link>
                        {alEditar ? (
                          <button
                            type="button"
                            className="btn btn-outline-primary"
                            onClick={() => alEditar(candidato)}
                          >
                            Editar
                          </button>
                        ) : null}
                        {alEliminar ? (
                          <button
                            type="button"
                            className="btn btn-outline-danger"
                            onClick={() => alEliminar(candidato)}
                          >
                            Eliminar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="d-md-none">
            {visibles.map((candidato) => (
              <article key={candidato.id} className="card m-3 border shadow-none">
                <div className="card-body">
                  <h3 className="h6 mb-1">
                    <Link to={`/candidatos/${candidato.id}`}>{candidato.nombre}</Link>
                  </h3>
                  <p className="small text-secondary mb-2">
                    {candidato.cargo} · {candidato.familiaCargo}
                  </p>
                  <p className="small mb-1">
                    <i className="bi bi-envelope me-1" aria-hidden="true" />
                    {candidato.correo}
                  </p>
                  <p className="small mb-3">
                    <i className="bi bi-telephone me-1" aria-hidden="true" />
                    {candidato.telefono}
                  </p>
                  <div className="d-flex gap-2">
                    <Link
                      to={`/candidatos/${candidato.id}`}
                      className="btn btn-sm btn-outline-primary"
                    >
                      Ver ficha
                    </Link>
                    {alEditar ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => alEditar(candidato)}
                      >
                        Editar
                      </button>
                    ) : null}
                    {alEliminar ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => alEliminar(candidato)}
                      >
                        Eliminar
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {mostrarNuevo ? (
        <div className="card-footer bg-white d-flex justify-content-end">
          <Link to="/candidatos/nuevo" className="btn btn-primary btn-sm">
            <i className="bi bi-person-plus me-1" aria-hidden="true" />
            Nuevo candidato
          </Link>
        </div>
      ) : null}
    </section>
  );
}
