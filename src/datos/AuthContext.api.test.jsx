import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProveedorAuth, useAuth } from './AuthContext';
import { obtenerToken } from '../servicios/api';

const respuesta = (datos, status = 200) => Promise.resolve(new Response(JSON.stringify(datos), { status }));
const montar = () =>
  renderHook(() => useAuth(), { wrapper: ({ children }) => <ProveedorAuth apiHabilitada>{children}</ProveedorAuth> });

describe('AuthContext con servidor', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('inicia sesión en el backend y guarda el token', async () => {
    fetch.mockReturnValue(
      respuesta({ token: 'jwt-servidor', usuario: { id: 4, nombre: 'Patricia Saavedra', rol: 'jefatura' } }),
    );
    const { result } = montar();

    let resultado;
    await act(async () => {
      resultado = await result.current.iniciarSesion('jefatura@aquachile.cl', 'clave');
    });

    expect(resultado.ok).toBe(true);
    expect(result.current.usuarioActual.nombre).toBe('Patricia Saavedra');
    expect(result.current.soloLectura).toBe(true);
    expect(obtenerToken()).toBe('jwt-servidor');
  });

  it('si el servidor rechaza las credenciales no usa los usuarios locales', async () => {
    fetch.mockReturnValue(respuesta({ error: 'Credenciales inválidas.' }, 401));
    const { result } = montar();

    let resultado;
    await act(async () => {
      resultado = await result.current.iniciarSesion('analista@aquachile.cl', 'AquaChile2026!');
    });

    expect(resultado).toEqual({ ok: false, error: 'Credenciales inválidas.' });
    expect(result.current.estaAutenticado).toBe(false);
  });

  it('si el servidor no responde entra con los usuarios de demostración', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = montar();

    await act(async () => {
      await result.current.iniciarSesion('analista@aquachile.cl', 'AquaChile2026!');
    });

    expect(result.current.usuarioActual.nombre).toBe('Carolina Muñoz');
    expect(obtenerToken()).toBeNull();
  });

  it('al cerrar sesión borra el token del servidor', async () => {
    fetch.mockReturnValue(respuesta({ token: 'jwt', usuario: { id: 1, nombre: 'Carolina Muñoz', rol: 'analista' } }));
    const { result } = montar();
    await act(async () => {
      await result.current.iniciarSesion('analista@aquachile.cl', 'x');
    });
    act(() => result.current.cerrarSesion());
    expect(obtenerToken()).toBeNull();
  });
});
