import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { autenticarUsuario } from './usuarios';
import { conectarApi, desconectarApi } from '../servicios/apiDocumentos';

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
      // En segundo plano: token del backend para la sección de documentos.
      conectarApi(correo, contrasena);
    }
    return resultado;
  }, []);

  const cerrarSesion = useCallback(() => {
    setUsuarioActual(null);
    guardarSesion(null);
    desconectarApi();
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
    // Fallback para pruebas unitarias de componentes aislados que no montan ProveedorAuth
    return {
      usuarioActual: {
        id: 0,
        nombre: 'Usuario Demo',
        correo: 'demo@aquachile.cl',
        rol: 'admin',
        cargo: 'Administrador Demo',
      },
      estaAutenticado: true,
      esAnalista: true,
      esEvaluador: true,
      iniciarSesion: () => ({ ok: true }),
      cerrarSesion: () => {},
    };
  }
  return contexto;
}

export { ContextoAuth };
