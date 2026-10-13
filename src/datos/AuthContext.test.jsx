import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ProveedorAuth, useAuth } from './AuthContext';

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

  it('permite autenticar un analista y actualiza los indicadores de rol', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperConAuth });

    act(() => {
      const resp = result.current.iniciarSesion('analista@aquachile.cl', 'AquaChile2026!');
      expect(resp.ok).toBe(true);
    });

    expect(result.current.estaAutenticado).toBe(true);
    expect(result.current.esAnalista).toBe(true);
    expect(result.current.esEvaluador).toBe(false);
    expect(result.current.usuarioActual.nombre).toBe('Carolina Muñoz');
  });

  it('permite autenticar un evaluador y actualiza los indicadores de rol', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperConAuth });

    act(() => {
      const resp = result.current.iniciarSesion('ignacia.valdes@aquachile.cl', 'AquaChile2026!');
      expect(resp.ok).toBe(true);
    });

    expect(result.current.estaAutenticado).toBe(true);
    expect(result.current.esAnalista).toBe(false);
    expect(result.current.esEvaluador).toBe(true);
    expect(result.current.usuarioActual.cargo).toBe('Psicóloga Evaluadora');
  });

  it('rechaza contraseñas incorrectas y no modifica la sesión', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperConAuth });

    act(() => {
      const resp = result.current.iniciarSesion('analista@aquachile.cl', 'erronea');
      expect(resp.ok).toBe(false);
      expect(resp.error).toBeDefined();
    });

    expect(result.current.estaAutenticado).toBe(false);
    expect(result.current.usuarioActual).toBeNull();
  });

  it('cierra la sesión correctamente', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapperConAuth });

    act(() => {
      result.current.iniciarSesion('evaluador@aquachile.cl', 'AquaChile2026!');
    });
    expect(result.current.estaAutenticado).toBe(true);

    act(() => {
      result.current.cerrarSesion();
    });
    expect(result.current.estaAutenticado).toBe(false);
    expect(result.current.usuarioActual).toBeNull();
  });
});
