import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { autenticarUsuario } from './usuarios';

const ContextoAuth = createContext(null);
const CLAVE_SESION = 'aquachile_sesion_activa';

function obtenerSesionAlmacenada() {
  try {
    const raw = sessionStorage.getItem(CLAVE_SESION);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function guardarSesion(usuario) {
  try {
    if (usuario) {
      sessionStorage.setItem(CLAVE_SESION, JSON.stringify(usuario));
    } else {
      sessionStorage.removeItem(CLAVE_SESION);
    }
  } catch {
    // Si sessionStorage no está disponible, se mantiene en memoria
  }
}

/**
 * Proveedor de autenticación y control de acceso por roles (RBAC).
 */
export function ProveedorAuth({ children, usuarioInicial = undefined }) {
  const [usuarioActual, setUsuarioActual] = useState(() => {
    if (usuarioInicial !== undefined) {
      return usuarioInicial;
    }
    return obtenerSesionAlmacenada();
  });

  const iniciarSesion = useCallback((correo, contrasena) => {
    const resultado = autenticarUsuario(correo, contrasena);
    if (resultado.ok) {
      setUsuarioActual(resultado.usuario);
      guardarSesion(resultado.usuario);
    }
    return resultado;
  }, []);

  const cerrarSesion = useCallback(() => {
    setUsuarioActual(null);
    guardarSesion(null);
  }, []);

  const valor = useMemo(
    () => ({
      usuarioActual,
      estaAutenticado: Boolean(usuarioActual),
      esAnalista: usuarioActual?.rol === 'analista' || usuarioActual?.rol === 'admin',
      esEvaluador: usuarioActual?.rol === 'evaluador' || usuarioActual?.rol === 'admin',
      iniciarSesion,
      cerrarSesion,
    }),
    [usuarioActual, iniciarSesion, cerrarSesion],
  );

  return <ContextoAuth.Provider value={valor}>{children}</ContextoAuth.Provider>;
}

export function useAuth() {
  const contexto = useContext(ContextoAuth);
  if (!contexto) {
    // Sin proveedor no hay sesión: se falla explícitamente en vez de asumir un usuario
    // con todos los permisos (las pruebas montan ProveedorAuth con renderConContexto).
    throw new Error('useAuth debe usarse dentro de un <ProveedorAuth>.');
  }
  return contexto;
}

export { ContextoAuth };
