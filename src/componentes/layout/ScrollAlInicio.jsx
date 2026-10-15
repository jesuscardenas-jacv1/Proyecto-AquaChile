import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Vuelve al inicio de la página cada vez que cambia la ruta.
 * React Router no lo hace solo: sin esto, al pasar de una página larga (como el Planner)
 * a otra, la nueva se abre a la misma altura y parece vacía o "atrapada".
 * Solo reacciona al cambio de ruta (pathname), no a filtros en la URL (?q=, ?pagina=).
 */
export default function ScrollAlInicio() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
