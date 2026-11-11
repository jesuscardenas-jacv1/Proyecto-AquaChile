import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { guardarToken, obtenerToken, URL_API } from './api';
import { apiIa, useIaDisponible } from './apiIa';

const respuestaJson = (datos, status = 200) => Promise.resolve(new Response(JSON.stringify(datos), { status }));

describe('apiIa', () => {
  beforeEach(() => {
    sessionStorage.clear();
    guardarToken('jwt-ia');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('consulta el estado con la sesión', async () => {
    fetch.mockReturnValue(respuestaJson({ ok: true, disponible: true, modelo: 'claude-opus-5-5' }));
    expect(await apiIa.estado()).toMatchObject({ disponible: true });
    expect(fetch).toHaveBeenCalledWith(
      `${URL_API}/ia/estado`,
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer jwt-ia' }) }),
    );
  });

  it('sin análisis guardado devuelve null, y con uno lo entrega', async () => {
    fetch.mockReturnValueOnce(respuestaJson({ error: 'Esta postulación aún no tiene análisis.' }, 404));
    expect(await apiIa.obtenerAnalisis(7)).toBeNull();

    fetch.mockReturnValueOnce(respuestaJson({ analisis: { postulacionId: 7 } }));
    expect(await apiIa.obtenerAnalisis(7)).toEqual({ postulacionId: 7 });
  });

  it('pide el análisis de una postulación', async () => {
    fetch.mockReturnValue(respuestaJson({ analisis: { postulacionId: 7 } }, 201));
    expect(await apiIa.analizarPostulacion(7)).toEqual({ postulacionId: 7 });
    expect(fetch).toHaveBeenCalledWith(`${URL_API}/ia/postulaciones/7/analisis`, expect.objectContaining({ method: 'POST' }));
  });

  it('envía el CV en binario con su nombre', async () => {
    fetch.mockReturnValue(respuestaJson({ datos: { nombre: 'Ana' } }));
    const archivo = new File(['%PDF'], 'cv ana.pdf', { type: 'application/pdf' });
    expect(await apiIa.extraerDatosCv(archivo)).toEqual({ nombre: 'Ana' });
    const [url, opciones] = fetch.mock.calls[0];
    expect(url).toBe(`${URL_API}/ia/extraer-cv?nombre=cv+ana.pdf`);
    expect(opciones.body).toBe(archivo);
    expect(opciones.headers['Content-Type']).toBe('application/pdf');
  });

  it('pide el borrador de una oferta en JSON', async () => {
    fetch.mockReturnValue(respuestaJson({ oferta: { titulo: 'Gruero' } }));
    expect(await apiIa.redactarOferta({ cargo: 'Gruero' })).toEqual({ titulo: 'Gruero' });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ cargo: 'Gruero' });
  });

  it('entrega el mensaje del servidor y cierra la sesión vencida', async () => {
    fetch.mockReturnValueOnce(respuestaJson({ error: 'La IA no pudo procesar este documento.' }, 422));
    await expect(apiIa.analizarPostulacion(7)).rejects.toThrow('La IA no pudo procesar este documento.');

    fetch.mockReturnValueOnce(respuestaJson({}, 401));
    await expect(apiIa.estado()).rejects.toMatchObject({ status: 401 });
    expect(obtenerToken()).toBeNull();
  });

  it('sin sesión o sin conexión informa que no está disponible', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(apiIa.estado()).rejects.toThrow(/no se pudo conectar/i);
    guardarToken(null);
    await expect(apiIa.estado()).rejects.toThrow(/necesita una sesión/i);
  });

  it('useIaDisponible es false sin sesión y refleja el estado del servidor con sesión', async () => {
    const sinSesion = { conectado: () => false, estado: vi.fn() };
    expect(renderHook(() => useIaDisponible(sinSesion)).result.current).toBe(false);
    expect(sinSesion.estado).not.toHaveBeenCalled();

    const conIa = { conectado: () => true, estado: vi.fn().mockResolvedValue({ disponible: true }) };
    const { result } = renderHook(() => useIaDisponible(conIa));
    await waitFor(() => expect(result.current).toBe(true));

    const caido = { conectado: () => true, estado: vi.fn().mockRejectedValue(new Error('x')) };
    const otro = renderHook(() => useIaDisponible(caido));
    await waitFor(() => expect(caido.estado).toHaveBeenCalled());
    expect(otro.result.current).toBe(false);
  });
});
