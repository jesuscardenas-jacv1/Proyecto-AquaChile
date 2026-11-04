import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useDatos } from '../../datos/DatosContext';
import Navbar from './Navbar';
import PiePagina from './PiePagina';
import EstadoServidor from '../comunes/EstadoServidor';
import ScrollAlInicio from './ScrollAlInicio';
import { moduloDeRuta } from '../../dominio/modulos';

/** Estructura general: barra lateral, contenido principal y pie de página. */
export default function Layout() {
  const { pathname } = useLocation();
  const { refrescar } = useDatos();

  // Cada pantalla parte con datos al día, aunque otro usuario acabe de cambiarlos.
  useEffect(() => {
    refrescar();
  }, [pathname, refrescar]);

  return (
    <div className="app-shell" data-modulo={moduloDeRuta(pathname)}>
      <ScrollAlInicio />
      <Navbar />
      <div className="app-contenido">
        <main className="app-principal flex-grow-1">
          <EstadoServidor />
          <Outlet />
        </main>
        <PiePagina />
      </div>
    </div>
  );
}
