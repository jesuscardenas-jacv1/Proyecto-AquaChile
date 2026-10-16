import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProveedorAuth, useAuth } from './AuthContext';
import { CLAVE_SESION, EVENTO_SESION_EXPIRADA } from '../servicios/sesion';

function wrapperConAuth({ children }) {
  return <ProveedorAuth>{children}</ProveedorAuth>;
}

describe('AuthContext', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });
  it('inicia sin usuario autenticado por defecto', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperConAuth });

    expect(result.current.usuarioActual).toBeNull();
    expect(result.current.estaAutenticado).toBe(false);
    expect(result.current.esAnalista).toBe(false);
    expect(result.current.esEvaluador).toBe(false);
  });

  it('permite autenticar un analista y actualiza los indicadores de rol', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperConAuth });

    let resp;
    await act(async () => {
      resp = await result.current.iniciarSesion('analista@aquachile.cl', 'AquaChile2026!');
    });
    expect(resp.ok).toBe(true);


    expect(result.current.estaAutenticado).toBe(true);
    expect(result.current.esAnalista).toBe(true);
    expect(result.current.esEvaluador).toBe(false);
    expect(result.current.usuarioActual.nombre).toBe('Carolina Muñoz');
  });

  it('permite autenticar un evaluador y actualiza los indicadores de rol', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperConAuth });

    let resp;
    await act(async () => {
      resp = await result.current.iniciarSesion('mvictoria.bustamante@aquachile.cl', 'AquaChile2026!');
    });
    expect(resp.ok).toBe(true);


    expect(result.current.estaAutenticado).toBe(true);
    expect(result.current.esAnalista).toBe(false);
    expect(result.current.esEvaluador).toBe(true);
    expect(result.current.usuarioActual.cargo).toBe('Psicóloga Evaluadora');
  });

  it('rechaza contraseñas incorrectas y no modifica la sesión', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperConAuth });

    let resp;
    await act(async () => {
      resp = await result.current.iniciarSesion('analista@aquachile.cl', 'erronea');
    });
    expect(resp.ok).toBe(false);
    expect(resp.error).toBeDefined();


    expect(result.current.estaAutenticado).toBe(false);
    expect(result.current.usuarioActual).toBeNull();
  });

  it('cierra la sesión correctamente', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperConAuth });

    await act(async () => {
      await result.current.iniciarSesion('evaluador@aquachile.cl', 'AquaChile2026!');
    });
    expect(result.current.estaAutenticado).toBe(true);

    act(() => {
      result.current.cerrarSesion();
    });
    expect(result.current.estaAutenticado).toBe(false);
    expect(result.current.usuarioActual).toBeNull();
  });

  it('falla si se usa fuera de ProveedorAuth en vez de asumir un administrador', () => {
    expect(() => renderHook(() => useAuth())).toThrowError(
      'useAuth debe usarse dentro de un <ProveedorAuth>.',
    );
  });

  it('usa el servicio recibido para autenticar y guarda el token de la sesión', async () => {
    const servicio = {
      iniciarSesion: vi.fn().mockResolvedValue({
        usuario: { id: 1, nombre: 'Carolina Muñoz', rol: 'analista' },
        token: 'jwt-de-prueba',
      }),
    };
    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => <ProveedorAuth servicio={servicio}>{children}</ProveedorAuth>,
    });

    await act(async () => {
      await result.current.iniciarSesion('analista@aquachile.cl', 'AquaChile2026!');
    });

    expect(servicio.iniciarSesion).toHaveBeenCalledWith('analista@aquachile.cl', 'AquaChile2026!');
    expect(result.current.token).toBe('jwt-de-prueba');
    expect(JSON.parse(sessionStorage.getItem(CLAVE_SESION)).token).toBe('jwt-de-prueba');
  });

  it('recupera la sesión guardada al recargar la página', () => {
    sessionStorage.setItem(
      CLAVE_SESION,
      JSON.stringify({ usuario: { id: 2, nombre: 'Evaluadora', rol: 'evaluador' }, token: 't' }),
    );
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperConAuth });
    expect(result.current.esEvaluador).toBe(true);
    expect(result.current.token).toBe('t');
  });

  it('cierra la sesión y avisa cuando la API informa que el token expiró', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperConAuth });
    await act(async () => {
      await result.current.iniciarSesion('evaluador@aquachile.cl', 'AquaChile2026!');
    });

    act(() => {
      window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA));
    });

    expect(result.current.estaAutenticado).toBe(false);
    expect(result.current.avisoSesion).toMatch(/expiró/);
    expect(sessionStorage.getItem(CLAVE_SESION)).toBeNull();
  });
});
