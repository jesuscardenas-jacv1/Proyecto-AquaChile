import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import logoAquaChile from '../../assets/logo-aquachile-blanco.png';
import { useAuth } from '../../datos/AuthContext';

/**
 * Navegación principal con control de acceso por roles.
 * En escritorio es una barra lateral fija (diseño "Austral"); en pantallas pequeñas
 * se convierte en una barra superior con menú desplegable.
 */
export default function Navbar() {
  const [abierto, setAbierto] = useState(false);
  const { usuarioActual, esAnalista, cerrarSesion } = useAuth();
  const navegar = useNavigate();

  const enlaces = [
    { ruta: '/', etiqueta: 'Dashboard', icono: 'bi-grid-1x2', exacto: true },
    { ruta: '/candidatos', etiqueta: 'Candidatos', icono: 'bi-people' },
    { ruta: '/solicitudes', etiqueta: 'Solicitudes', icono: 'bi-clipboard' },
    { ruta: '/planner', etiqueta: 'Planner', icono: 'bi-calendar3' },
    ...(esAnalista ? [{ ruta: '/solicitudes/nueva', etiqueta: 'Nueva solicitud', icono: 'bi-plus-circle' }] : []),
  ];

  const clasesEnlace = ({ isActive }) => `barra-enlace ${isActive ? 'active' : ''}`.trim();

  const manejarCerrarSesion = () => {
    cerrarSesion();
    navegar('/login', { replace: true });
  };

  return (
    <aside className="barra-lateral" aria-label="Navegación principal">
      <div className="barra-cabecera d-flex align-items-center justify-content-between">
        <NavLink className="d-flex align-items-center gap-2 text-decoration-none" to="/" aria-label="Inicio AquaChile">
          <img src={logoAquaChile} alt="AquaChile" className="navbar-logo" />
          <small className="barra-modulo">Gestión Psicolaboral</small>
        </NavLink>

        <button
          className="btn btn-outline-light border-0 barra-toggler d-lg-none"
          type="button"
          aria-label="Alternar navegación"
          aria-expanded={abierto}
          aria-controls="menu-principal"
          onClick={() => setAbierto((valor) => !valor)}
        >
          <i className={`bi ${abierto ? 'bi-x-lg' : 'bi-list'} fs-5`} aria-hidden="true" />
        </button>
      </div>

      <div id="menu-principal" className={`collapse d-lg-block ${abierto ? 'show' : ''}`.trim()}>
        <p className="barra-titulo text-uppercase mb-2">Módulos operativos</p>
        <ul className="nav flex-column gap-1">
          {enlaces.map(({ ruta, etiqueta, icono, exacto }) => (
            <li className="nav-item" key={ruta}>
              <NavLink to={ruta} end={exacto} className={clasesEnlace} onClick={() => setAbierto(false)}>
                <i className={`bi ${icono}`} aria-hidden="true" />
                <span>{etiqueta}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        {usuarioActual ? (
          <div className="barra-usuario mt-auto">
            <div className="d-flex align-items-center gap-2 mb-2">
              <span className="barra-avatar" aria-hidden="true">
                <i className="bi bi-person" />
              </span>
              <div className="lh-sm overflow-hidden">
                <span className="d-block small fw-semibold text-truncate">{usuarioActual.nombre}</span>
                <span className="d-block small text-secondary">
                  {usuarioActual.rol === 'analista' ? 'Analista' : 'Evaluador'}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-2"
              onClick={manejarCerrarSesion}
              title="Cerrar sesión corporativa"
            >
              <i className="bi bi-box-arrow-right" aria-hidden="true" />
              Cerrar sesión
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
