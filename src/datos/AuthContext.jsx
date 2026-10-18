import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { autenticarUsuario } from './usuarios';
import { API_HABILITADA, cerrarSesionApi, iniciarSesionApi } from '../servicios/api';

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
export function ProveedorAuth({ children, usuarioInicial = undefined, apiHabilitada = API_HABILITADA }) {
  const [usuarioActual, setUsuarioActual] = useState(() => {
    if (usuarioInicial !== undefined) {
      return usuarioInicial;
    }
    return obtenerSesionAlmacenada();
  });

  const entrar = useCallback((usuario) => {
    setUsuarioActual(usuario);
    guardarSesion(usuario);
  }, []);

  /**
   * Inicia sesión contra el backend (los datos quedan en la base de datos). Si el
   * servidor no responde, usa los usuarios de demostración del navegador (modo local).
   */
  const iniciarSesion = useCallback(
    async (correo, contrasena) => {
      if (apiHabilitada) {
        try {
          const resultado = await iniciarSesionApi(correo, contrasena);
          if (resultado.ok) entrar(resultado.usuario);
          return resultado;
        } catch {
          // Servidor no disponible: se continúa en modo local.
        }
      }
      const resultado = autenticarUsuario(correo, contrasena);
      if (resultado.ok) entrar(resultado.usuario);
      return resultado;
    },
    [apiHabilitada, entrar],
  );

  const cerrarSesion = useCallback(() => {
    setUsuarioActual(null);
    guardarSesion(null);
    cerrarSesionApi();
  }, []);

  const valor = useMemo(
    () => ({
      usuarioActual,
      estaAutenticado: Boolean(usuarioActual),
      // El administrador académico puede hacer todo lo del analista y del evaluador.
      esAdmin: usuarioActual?.rol === 'admin',
      esAnalista: usuarioActual?.rol === 'analista' || usuarioActual?.rol === 'admin',
      esEvaluador: usuarioActual?.rol === 'evaluador' || usuarioActual?.rol === 'admin',
      // La jefatura solo consulta: no modifica datos.
      esJefatura: usuarioActual?.rol === 'jefatura',
      soloLectura: usuarioActual?.rol === 'jefatura',
      // El evaluador solo ve a los candidatos que el analista pasó a evaluación.
      soloEnEvaluacion: usuarioActual?.rol === 'evaluador',
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
      esAdmin: true,
      esAnalista: true,
      esEvaluador: true,
      esJefatura: false,
      soloLectura: false,
      soloEnEvaluacion: false,
      iniciarSesion: async () => ({ ok: true }),
      cerrarSesion: () => {},
    };
  }
  return contexto;
}

export { ContextoAuth };
