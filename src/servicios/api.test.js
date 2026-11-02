import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_HABILITADA, URL_API, apiDatos, backendDisponible, obtenerToken, solicitar } from './api';

const respuesta = (datos, status = 200) => Promise.resolve(new Response(JSON.stringify(datos), { status }));

describe('cliente de la API', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('está deshabilitado en las pruebas unitarias', () => {
    expect(API_HABILITADA).toBe(false);
  });

  it('detecta si el backend responde', async () => {
    fetch.mockReturnValueOnce(respuesta({ ok: true }));
    expect(await backendDisponible()).toBe(true);
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await backendDisponible({ pausaMs: 0 })).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('reintenta una vez si la primera llamada falla (p. ej. recién encendido el equipo)', async () => {
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockReturnValueOnce(respuesta({ ok: true }));
    expect(await backendDisponible({ pausaMs: 0 })).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('exige sesión salvo en las rutas públicas', async () => {
    await expect(solicitar('/candidatos')).rejects.toMatchObject({ status: 401, noDisponible: true });
    fetch.mockReturnValue(respuesta({ ofertas: [] }));
    await expect(solicitar('/ofertas', { publico: true })).resolves.toEqual({ ofertas: [] });
    expect(fetch.mock.calls[0][1].headers).toEqual({});
  });

  it('envía JSON con el token y descarta el token vencido', async () => {
    sessionStorage.setItem('aquachile_token_api', 'jwt');
    fetch.mockReturnValueOnce(respuesta({ candidato: { id: 9 } }, 201));
    expect(await apiDatos.crearCandidato({ nombre: 'Ana' })).toEqual({ id: 9 });
    const [url, opciones] = fetch.mock.calls[0];
    expect(url).toBe(`${URL_API}/candidatos`);
    expect(opciones.headers).toEqual({ Authorization: 'Bearer jwt', 'Content-Type': 'application/json' });
    expect(JSON.parse(opciones.body)).toEqual({ nombre: 'Ana' });

    fetch.mockReturnValueOnce(respuesta({ error: 'Token inválido o expirado.' }, 401));
    await expect(apiDatos.eliminarCandidato(9)).rejects.toMatchObject({ message: 'Token inválido o expirado.' });
    expect(obtenerToken()).toBeNull();
  });

  it('carga todo según el rol: el evaluador no pide postulaciones', async () => {
    sessionStorage.setItem('aquachile_token_api', 'jwt');
    fetch.mockImplementation((url) => {
      const recurso = url.replace(URL_API, '').slice(1);
      return respuesta({ [recurso]: [recurso] });
    });

    const datos = await apiDatos.cargarTodo('evaluador');
    expect(datos.postulaciones).toEqual([]);
    expect(datos.candidatos).toEqual(['candidatos']);
    expect(fetch.mock.calls.map(([url]) => url)).not.toContain(`${URL_API}/postulaciones`);

    await apiDatos.cargarTodo('analista');
    expect(fetch.mock.calls.map(([url]) => url)).toContain(`${URL_API}/postulaciones`);
  });

  it('usa PUT si la evaluación ya existe y POST si es nueva', async () => {
    sessionStorage.setItem('aquachile_token_api', 'jwt');
    fetch.mockReturnValue(respuesta({ evaluacion: { id: 1 } }));

    await apiDatos.guardarEvaluacion(5, { resultado: 'Recomendado' }, 1);
    await apiDatos.guardarEvaluacion(5, { resultado: 'Recomendado' });

    expect(fetch.mock.calls[0][0]).toBe(`${URL_API}/evaluaciones/1`);
    expect(fetch.mock.calls[0][1].method).toBe('PUT');
    expect(fetch.mock.calls[1][0]).toBe(`${URL_API}/evaluaciones`);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ solicitudId: 5, resultado: 'Recomendado' });
  });

  it('postula sin token y mueve etapas con su agenda', async () => {
    fetch.mockReturnValueOnce(respuesta({ postulacion: { id: 3 } }, 201));
    expect(await apiDatos.postular(1, { nombre: 'Ana' })).toEqual({ id: 3 });
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();

    sessionStorage.setItem('aquachile_token_api', 'jwt');
    fetch.mockReturnValueOnce(respuesta({ solicitud: { id: 7, etapa: 'agendada' } }));
    await apiDatos.moverEtapa(7, 'agendada', { fechaEntrevista: '2026-10-22' });
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ etapa: 'agendada', fechaEntrevista: '2026-10-22' });
  });
});
