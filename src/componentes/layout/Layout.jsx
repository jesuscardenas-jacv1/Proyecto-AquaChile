import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import PiePagina from './PiePagina';
import ScrollAlInicio from './ScrollAlInicio';

/** Estructura general: barra lateral, contenido principal y pie de página. */
export default function Layout() {
  return (
    <div className="app-shell">
      <ScrollAlInicio />
      <Navbar />
      <div className="app-contenido">
        <main className="app-principal flex-grow-1">
          <Outlet />
        </main>
        <PiePagina />
      </div>
    </div>
  );
}
