import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import logoAquaChile from '../../assets/logo-aquachile-blanco.png';
import { useAuth } from '../../datos/AuthContext';
import { ROLES } from '../../datos/usuarios';
import { obtenerToken } from '../../servicios/api';
import AvatarUsuario from '../perfil/AvatarUsuario';
import VentanaPerfil from '../perfil/VentanaPerfil';

const CLAVE_COLAPSADA = 'aquachile_menu_colapsado';

function leerColapsada() {
  try {
    return localStorage.getItem(CLAVE_COLAPSADA) === 'si';
  } catch {
    return false;
  }
}

/**
 * Navegación principal con control de acceso por roles.
 * En escritorio es una barra lateral fija (diseño "Austral") que se puede contraer a
 * solo íconos; la preferencia se recuerda en el navegador. En pantallas pequeñas se
 * convierte en una barra superior con menú desplegable.
 */
export default function Navbar() {
  const [abierto, setAbierto] = useState(false);
  const [colapsada, setColapsada] = useState(leerColapsada);

  const alternarColapsada = () => {
    setColapsada((actual) => {
      try {
        localStorage.setItem(CLAVE_COLAPSADA, actual ? 'no' : 'si');
      } catch {
        // Sin localStorage la preferencia dura solo esta visita.
      }
      return !actual;
    });
  };
  const { usuarioActual, esAnalista, esEvaluador, esAdmin, esJefatura, cerrarSesion } = useAuth();
  const [perfilAbierto, setPerfilAbierto] = useState(false);
  const navegar = useNavigate();

  const enlaces = [
    { ruta: '/', etiqueta: 'Dashboard', icono: 'bi-grid-1x2', exacto: true },
    ...(esAnalista || esJefatura
      ? [{ ruta: '/postulaciones', etiqueta: 'Postulaciones', icono: 'bi-person-lines-fill' }]
      : []),
    { ruta: '/candidatos', etiqueta: 'Candidatos', icono: 'bi-people' },
    { ruta: '/solicitudes', etiqueta: 'Solicitudes', icono: 'bi-clipboard' },
    // El Planner es la herramienta de la psicóloga; la jefatura lo consulta en modo lectura.
    ...(esEvaluador || esJefatura ? [{ ruta: '/planner', etiqueta: 'Planner', icono: 'bi-calendar3' }] : []),
    ...(esAnalista ? [{ ruta: '/solicitudes/nueva', etiqueta: 'Nueva solicitud', icono: 'bi-plus-circle' }] : []),
    ...(esAdmin ? [{ ruta: '/administracion', etiqueta: 'Administración', icono: 'bi-gear' }] : []),
  ];

  const clasesEnlace = ({ isActive }) => `barra-enlace ${isActive ? 'active' : ''}`.trim();

  const manejarCerrarSesion = () => {
    cerrarSesion();
    navegar('/login', { replace: true });
  };

  return (
    <aside className={`barra-lateral ${colapsada ? 'barra-colapsada' : ''}`.trim()} aria-label="Navegación principal">
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
        <p className="barra-titulo barra-texto text-uppercase mb-2">Módulos operativos</p>
        <ul className="nav flex-column gap-1">
          {enlaces.map(({ ruta, etiqueta, icono, exacto }) => (
            <li className="nav-item" key={ruta}>
              <NavLink
                to={ruta}
                end={exacto}
                className={clasesEnlace}
                title={colapsada ? etiqueta : undefined}
                onClick={() => setAbierto(false)}
              >
                <i className={`bi ${icono}`} aria-hidden="true" />
                <span className="barra-texto">{etiqueta}</span>
              </NavLink>
            </li>
          ))}
        </ul>

        <button
          className="btn btn-sm border-0 barra-colapsar d-none d-lg-flex mt-auto"
          type="button"
          aria-label={colapsada ? 'Expandir menú' : 'Contraer menú'}
          aria-expanded={!colapsada}
          aria-controls="menu-principal"
          title={colapsada ? 'Expandir menú' : 'Contraer menú'}
          onClick={alternarColapsada}
        >
          <i className={`bi ${colapsada ? 'bi-chevron-double-right' : 'bi-chevron-double-left'}`} aria-hidden="true" />
          <span className="barra-texto">Contraer menú</span>
        </button>

        {usuarioActual ? (
          <div className="barra-usuario">
            <button
              type="button"
              className="barra-perfil d-flex align-items-center gap-2 mb-2 w-100"
              aria-label={`Mi perfil: ${usuarioActual.nombre}`}
              aria-haspopup="dialog"
              title={colapsada ? 'Mi perfil' : undefined}
              onClick={() => {
                setAbierto(false);
                setPerfilAbierto(true);
              }}
            >
              <AvatarUsuario usuario={usuarioActual} className="barra-avatar" />
              <span className="lh-sm overflow-hidden barra-texto text-start flex-grow-1">
                <span className="d-block small fw-semibold text-truncate">{usuarioActual.nombre}</span>
                <span className="d-block small text-secondary">
                  {ROLES[usuarioActual.rol]?.etiqueta ?? usuarioActual.rol}
                </span>
              </span>
              <i className="bi bi-chevron-right small text-secondary barra-texto" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-2"
              onClick={manejarCerrarSesion}
              title="Cerrar sesión corporativa"
            >
              <i className="bi bi-box-arrow-right" aria-hidden="true" />
              <span className="barra-texto">Cerrar sesión</span>
            </button>
          </div>
        ) : null}
      </div>
      {perfilAbierto ? (
        <VentanaPerfil
          conServidor={Boolean(obtenerToken())}
          alCerrar={() => setPerfilAbierto(false)}
          alCerrarSesion={() => {
            setPerfilAbierto(false);
            manejarCerrarSesion();
          }}
        />
      ) : null}
    </aside>
  );
}
