import { Link, Outlet } from 'react-router-dom';
import logoAquaChile from '../../assets/logo-aquachile-blanco.png';
import PiePagina from './PiePagina';
import ScrollAlInicio from './ScrollAlInicio';

/** Estructura del portal público "Trabaja con nosotros" (sin sesión). */
export default function LayoutPublico() {
  return (
    <div className="d-flex flex-column min-vh-100 bg-body-tertiary">
      <ScrollAlInicio />
      <header className="navbar navbar-dark bg-primary shadow-sm">
        <div className="container">
          <Link className="navbar-brand d-flex align-items-center gap-3" to="/trabaja-con-nosotros">
            <img src={logoAquaChile} alt="AquaChile" className="navbar-logo" />
            <small className="navbar-modulo d-none d-sm-block text-white-50">Trabaja con nosotros</small>
          </Link>
          <Link to="/login" className="btn btn-sm btn-outline-light">
            <i className="bi bi-person-lock me-1" aria-hidden="true" />
            Acceso colaboradores
          </Link>
        </div>
      </header>
      <main className="container py-4 flex-grow-1">
        <Outlet />
      </main>
      <PiePagina />
    </div>
  );
}
