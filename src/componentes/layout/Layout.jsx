import { Outlet } from 'react-router-dom';
import { useDatos } from '../../datos/DatosContext';
import Mensaje from '../comunes/Mensaje';
import { mensajeDeError } from '../../servicios/errores';
import Navbar from './Navbar';
import PiePagina from './PiePagina';
import ScrollAlInicio from './ScrollAlInicio';

/**
 * Estructura general: navbar, contenido principal y pie de página.
 * Mientras se cargan los datos desde la API muestra un indicador, y si la carga falla
 * (por ejemplo, el backend no está en ejecución) ofrece reintentar.
 */
export default function Layout() {
  const { cargando, errorCarga, recargar } = useDatos();

  let contenido = <Outlet />;
  if (cargando) {
    contenido = (
      <div className="d-flex justify-content-center align-items-center gap-2 py-5 text-secondary">
        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
        Cargando datos…
      </div>
    );
  } else if (errorCarga) {
    contenido = (
      <Mensaje tipo="danger" titulo="No se pudieron cargar los datos">
        {mensajeDeError(errorCarga)}
        <div className="mt-2">
          <button type="button" className="btn btn-sm btn-primary" onClick={recargar}>
            Reintentar
          </button>
        </div>
      </Mensaje>
    );
  }

  return (
    <div className="d-flex flex-column min-vh-100 bg-body-tertiary">
      <ScrollAlInicio />
      <Navbar />
      <main className="container py-4 flex-grow-1">{contenido}</main>
      <PiePagina />
    </div>
  );
}
