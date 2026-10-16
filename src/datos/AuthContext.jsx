import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { crearServicioPorDefecto } from '../servicios/configuracion';
import { EVENTO_SESION_EXPIRADA, guardarSesion, leerSesion } from '../servicios/sesion';

const ContextoAuth = createContext(null);

/**
 * Proveedor de autenticación y control de acceso por roles (RBAC).
 *
 * - Modo API: el login se valida en el backend (POST /api/auth/login) y se guarda el JWT.
 * - Modo demo: el login se valida contra los usuarios de demostración (usuarios.js).
 *
 * @param {object} props
 * @param {object} [props.usuarioInicial] usuario ya autenticado (lo usan las pruebas)
 * @param {object} [props.servicio]       servicio de datos (por defecto, según el modo)
 */
export function ProveedorAuth({ children, usuarioInicial = undefined, servicio }) {
  const [servicioAuth] = useState(() => servicio ?? crearServicioPorDefecto());
  const [sesion, setSesion] = useState(() =>
    usuarioInicial !== undefined
      ? usuarioInicial && { usuario: usuarioInicial, token: null }
      : leerSesion(),
  );
  const [avisoSesion, setAvisoSesion] = useState('');

  /** Valida las credenciales. Devuelve { ok, usuario } o { ok: false, error }. */
  const iniciarSesion = useCallback(
    async (correo, contrasena) => {
      try {
        const nueva = await servicioAuth.iniciarSesion(correo, contrasena);
        setSesion(nueva);
        guardarSesion(nueva);
        setAvisoSesion('');
        return { ok: true, usuario: nueva.usuario };
      } catch (error) {
        return { ok: false, error: error.message || 'No fue posible iniciar sesión.' };
      }
    },
    [servicioAuth],
  );

  const cerrarSesion = useCallback(() => {
    setSesion(null);
    guardarSesion(null);
  }, []);

  // La API avisa (401) cuando el token venció: se cierra la sesión y se informa en el login.
  useEffect(() => {
    const alExpirar = () => {
      cerrarSesion();
      setAvisoSesion('Su sesión expiró. Vuelva a iniciar sesión.');
    };
    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
    return () => window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
  }, [cerrarSesion]);

  const usuarioActual = sesion?.usuario ?? null;

  const valor = useMemo(
    () => ({
      usuarioActual,
      token: sesion?.token ?? null,
      estaAutenticado: Boolean(usuarioActual),
      esAnalista: usuarioActual?.rol === 'analista' || usuarioActual?.rol === 'admin',
      esEvaluador: usuarioActual?.rol === 'evaluador' || usuarioActual?.rol === 'admin',
      avisoSesion,
      iniciarSesion,
      cerrarSesion,
    }),
    [sesion, usuarioActual, avisoSesion, iniciarSesion, cerrarSesion],
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
