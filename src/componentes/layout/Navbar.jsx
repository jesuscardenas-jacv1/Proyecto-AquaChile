import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import logoAquaChile from '../../assets/logo-aquachile-blanco.png';

const ENLACES = [
  { ruta: '/', etiqueta: 'Dashboard', exacto: true },
  { ruta: '/candidatos', etiqueta: 'Candidatos' },
  { ruta: '/solicitudes', etiqueta: 'Solicitudes' },
  { ruta: '/solicitudes/nueva', etiqueta: 'Nueva solicitud' },
];

/**
 * Barra de navegación colapsable de Bootstrap.
 * El colapso se controla con estado de React (no requiere el JS de Bootstrap).
 */
export default function Navbar() {
  const [abierto, setAbierto] = useState(false);

  const clasesEnlace = ({ isActive }) =>
    `nav-link px-2 py-1 rounded ${isActive ? 'active fw-semibold' : ''}`;

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
          <ul className="navbar-nav ms-auto mb-2 mb-lg-0">
            {ENLACES.map(({ ruta, etiqueta, exacto }) => (
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
          </ul>
        </div>
      </div>
    </nav>
  );
}
