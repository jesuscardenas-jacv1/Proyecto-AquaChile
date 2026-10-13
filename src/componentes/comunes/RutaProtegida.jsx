import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../datos/AuthContext';

/**
 * Guardián de rutas que verifica autenticación y roles permitidos.
 * Si no está autenticado, redirige a /login conservando la ruta intentada.
 * Si el rol no tiene permisos, redirige a la bandeja principal con un aviso.
 */
export default function RutaProtegida({ rolesPermitidos, children }) {
  const { estaAutenticado, usuarioActual } = useAuth();
  const ubicacion = useLocation();

  if (!estaAutenticado) {
    return <Navigate to="/login" replace state={{ desde: ubicacion }} />;
  }

  if (
    rolesPermitidos &&
    usuarioActual?.rol !== 'admin' &&
    !rolesPermitidos.includes(usuarioActual?.rol)
  ) {
    return (
      <Navigate
        to="/solicitudes"
        replace
        state={{
          mensaje: 'No tiene permisos para acceder a esa sección con su perfil actual.',
          tipo: 'warning',
        }}
      />
    );
  }

  return children ? children : <Outlet />;
}
