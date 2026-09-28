import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import PiePagina from './PiePagina';

/** Estructura general: navbar, contenido principal y pie de página. */
export default function Layout() {
  return (
    <div className="d-flex flex-column min-vh-100 bg-body-tertiary">
      <Navbar />
      <main className="container py-4 flex-grow-1">
        <Outlet />
      </main>
      <PiePagina />
    </div>
  );
}
