import { useState } from 'react';
import { useDatos } from '../datos/DatosContext';
import { ROLES, USUARIOS } from '../datos/usuarios';
import {
  ESTADOS_SOLICITUD,
  FAMILIAS_CARGO,
  MODALIDADES_ENTREVISTA,
  PROFESIONALES,
  RESULTADOS_EVALUACION,
} from '../datos/constantes';
import Mensaje from '../componentes/comunes/Mensaje';

const CATALOGOS = [
  { titulo: 'Familias de cargo', valores: FAMILIAS_CARGO },
  { titulo: 'Reclutadores/as', valores: PROFESIONALES },
  { titulo: 'Estados de solicitud', valores: ESTADOS_SOLICITUD },
  { titulo: 'Resultados de evaluación', valores: RESULTADOS_EVALUACION },
  { titulo: 'Modalidades de entrevista', valores: MODALIDADES_ENTREVISTA },
];

/**
 * Panel del Administrador académico: usuarios de prueba, roles y permisos,
 * catálogos del sistema y restablecimiento de los datos de demostración.
 */
export default function Administracion() {
  const { candidatos, solicitudes, evaluaciones, reiniciarDatos } = useDatos();
  const [confirmando, setConfirmando] = useState(false);
  const [mensaje, setMensaje] = useState(null);

  const restablecer = () => {
    reiniciarDatos();
    setConfirmando(false);
    setMensaje('Se restablecieron los datos de demostración.');
  };

  const totales = [
    ['Candidatos', candidatos.length],
    ['Solicitudes', solicitudes.length],
    ['Evaluaciones', evaluaciones.length],
  ];

  return (
    <div className="d-flex flex-column gap-3">
      <header>
        <h1 className="h4 mb-1">Administración</h1>
        <p className="text-secondary mb-0">
          Configuración del entorno de demostración: usuarios, roles, catálogos y datos de prueba.
        </p>
      </header>

      {mensaje ? (
        <Mensaje tipo="success" alCerrar={() => setMensaje(null)}>
          {mensaje}
        </Mensaje>
      ) : null}

      <section className="card border-0 shadow-sm" aria-labelledby="titulo-usuarios">
        <div className="card-header bg-white">
          <h2 id="titulo-usuarios" className="h6 mb-0">
            Usuarios de prueba
          </h2>
          <small className="text-secondary">Todos son ficticios; la contraseña de demostración está en el README.</small>
        </div>
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Acceso</th>
                <th scope="col">Rol</th>
                <th scope="col" className="d-none d-md-table-cell">
                  Cargo
                </th>
              </tr>
            </thead>
            <tbody>
              {USUARIOS.map((usuario) => (
                <tr key={usuario.id}>
                  <td className="fw-semibold">{usuario.nombre}</td>
                  <td className="small">{usuario.alias}</td>
                  <td>
                    <span className="badge bg-light text-primary border">
                      {ROLES[usuario.rol]?.etiqueta ?? usuario.rol}
                    </span>
                  </td>
                  <td className="small text-secondary d-none d-md-table-cell">{usuario.cargo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="titulo-roles">
        <h2 id="titulo-roles" className="h6 mb-2">
          Roles y permisos
        </h2>
        <div className="row g-3">
          {Object.entries(ROLES).map(([id, rol]) => (
            <div key={id} className="col-12 col-md-6 col-xl-3">
              <article className="card border-0 shadow-sm h-100" aria-label={rol.nombre}>
                <div className="card-body">
                  <h3 className="h6 mb-1">{rol.nombre}</h3>
                  <p className="small text-secondary">{rol.descripcion}</p>
                  <ul className="small mb-0 ps-3">
                    {rol.permisos.map((permiso) => (
                      <li key={permiso}>{permiso}</li>
                    ))}
                  </ul>
                </div>
              </article>
            </div>
          ))}
        </div>
      </section>

      <section className="card border-0 shadow-sm" aria-labelledby="titulo-catalogos">
        <div className="card-header bg-white">
          <h2 id="titulo-catalogos" className="h6 mb-0">
            Catálogos del sistema
          </h2>
          <small className="text-secondary">
            Valores usados en formularios y filtros. Se podrán editar al integrar el backend.
          </small>
        </div>
        <div className="card-body d-flex flex-column gap-3">
          {CATALOGOS.map(({ titulo, valores }) => (
            <div key={titulo}>
              <h3 className="h6 small text-secondary mb-2">
                {titulo} <span className="fw-normal">({valores.length})</span>
              </h3>
              <div className="d-flex flex-wrap gap-1">
                {valores.map((valor) => (
                  <span key={valor} className="badge bg-light text-dark border fw-normal">
                    {valor}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card border-0 shadow-sm" aria-labelledby="titulo-datos">
        <div className="card-header bg-white">
          <h2 id="titulo-datos" className="h6 mb-0">
            Datos de demostración
          </h2>
        </div>
        <div className="card-body">
          <dl className="row mb-3 small">
            {totales.map(([etiqueta, valor]) => (
              <div key={etiqueta} className="col-4">
                <dt className="text-secondary fw-normal">{etiqueta}</dt>
                <dd className="h5 mb-0">{valor}</dd>
              </div>
            ))}
          </dl>

          {confirmando ? (
            <Mensaje tipo="warning" titulo="¿Restablecer los datos de demostración?">
              Se perderán los candidatos, solicitudes y evaluaciones creados en este navegador y se
              cargarán nuevamente los datos ficticios iniciales.
              <div className="d-flex gap-2 mt-2">
                <button type="button" className="btn btn-sm btn-danger" onClick={restablecer}>
                  Sí, restablecer
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setConfirmando(false)}
                >
                  Cancelar
                </button>
              </div>
            </Mensaje>
          ) : (
            <button
              type="button"
              className="btn btn-outline-danger btn-sm"
              onClick={() => {
                setMensaje(null);
                setConfirmando(true);
              }}
            >
              <i className="bi bi-arrow-counterclockwise me-1" aria-hidden="true" />
              Restablecer datos de demostración
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
