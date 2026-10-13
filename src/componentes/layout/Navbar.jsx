import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import logoAquaChile from '../../assets/logo-aquachile-blanco.png';
import { useAuth } from '../../datos/AuthContext';

/**
 * Barra de navegación colapsable de Bootstrap con control de acceso por roles.
 */
export default function Navbar() {
  const [abierto, setAbierto] = useState(false);
  const { usuarioActual, esAnalista, cerrarSesion } = useAuth();
  const navegar = useNavigate();

  const enlaces = [
    { ruta: '/', etiqueta: 'Dashboard', exacto: true },
    { ruta: '/candidatos', etiqueta: 'Candidatos' },
    { ruta: '/solicitudes', etiqueta: 'Solicitudes' },
    ...(esAnalista ? [{ ruta: '/solicitudes/nueva', etiqueta: 'Nueva solicitud' }] : []),
  ];

  const clasesEnlace = ({ isActive }) =>
    `nav-link px-2 py-1 rounded ${isActive ? 'active fw-semibold' : ''}`;

  const manejarCerrarSesion = () => {
    cerrarSesion();
    navegar('/login', { replace: true });
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-primary shadow-sm sticky-top">
      <div className="container">
        <NavLink className="navbar-brand d-flex align-items-center gap-3" to="/">
          <img src={logoAquaChile} alt="AquaChile" className="navbar-logo" />
          <small className="navbar-modulo d-none d-sm-block text-white-50">Gestión Psicolaboral</small>
        </NavLink>

        <button
          className="navbar-toggler"
          type="button"
          aria-label="Alternar navegación"
          aria-expanded={abierto}
          aria-controls="menu-principal"
          onClick={() => setAbierto((valor) => !valor)}
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div
          id="menu-principal"
          className={`collapse navbar-collapse ${abierto ? 'show' : ''}`.trim()}
        >
          <ul className="navbar-nav ms-auto mb-2 mb-lg-0 align-items-lg-center">
            {enlaces.map(({ ruta, etiqueta, exacto }) => (
              <li className="nav-item" key={ruta}>
                <NavLink
                  to={ruta}
                  end={exacto}
                  className={clasesEnlace}
                  onClick={() => setAbierto(false)}
                >
                  {etiqueta}
                </NavLink>
              </li>
            ))}

            {usuarioActual ? (
              <li className="nav-item ms-lg-3 pt-2 pt-lg-0 border-top border-lg-0 border-white-50">
                <div className="d-flex align-items-center gap-2">
                  <span
                    className="badge bg-light text-primary fw-medium px-2 py-1"
                    title={`Perfil: ${usuarioActual.cargo || usuarioActual.rol}`}
                  >
                    {usuarioActual.rol === 'analista' ? 'Analista' : 'Evaluador'}
                  </span>
                  <span className="small text-white-50 d-none d-xl-inline">
                    {usuarioActual.nombre}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-light d-flex align-items-center gap-1 px-2 py-1"
                    onClick={manejarCerrarSesion}
                    aria-label="Cerrar sesión"
                    title="Cerrar sesión corporativa"
                  >
                    <i className="bi bi-box-arrow-right" aria-hidden="true" />
                    <span className="d-lg-none">Salir</span>
                  </button>
                </div>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </nav>
  );
}
