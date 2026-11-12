import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { guardarToken, obtenerToken, URL_API } from './api';
import { apiIa, useEstadoIa, useIaDisponible } from './apiIa';

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

  it('pide el borrador de la evaluación con las notas', async () => {
    fetch.mockReturnValue(respuestaJson({ borrador: { resultadoSugerido: 'Recomendado' } }));
    expect(await apiIa.borradorEvaluacion(5, 'Notas de la entrevista')).toEqual({ resultadoSugerido: 'Recomendado' });
    expect(fetch.mock.calls[0][0]).toBe(`${URL_API}/ia/solicitudes/5/borrador-evaluacion`);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ notas: 'Notas de la entrevista' });
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

  it('envía el audio de la entrevista con el consentimiento y el origen', async () => {
    fetch.mockReturnValue(respuestaJson({ transcripcion: 't', notas: null }, 201));
    const audio = new Blob(['a'], { type: 'audio/webm;codecs=opus' });
    expect(await apiIa.transcribirAudio(4, audio, 'reunion')).toMatchObject({ transcripcion: 't' });
    const [url, opciones] = fetch.mock.calls[0];
    expect(url).toBe(`${URL_API}/ia/solicitudes/4/transcripcion/audio?consentimiento=si&origen=reunion`);
    expect(opciones.body).toBe(audio);
    expect(opciones.headers['Content-Type']).toBe('audio/webm;codecs=opus');
  });

  it('sube una transcripción exportada o el texto pegado', async () => {
    fetch.mockReturnValue(respuestaJson({ transcripcion: 't' }, 201));
    const archivo = new File(['WEBVTT'], 'reunion.vtt', { type: 'text/vtt' });
    await apiIa.subirTranscripcion(4, archivo);
    expect(fetch.mock.calls[0][0]).toBe(`${URL_API}/ia/solicitudes/4/transcripcion?consentimiento=si&nombre=reunion.vtt`);
    expect(fetch.mock.calls[0][1].body).toBe(archivo);

    await apiIa.subirTranscripcion(4, 'Entrevistadora: hola');
    const [url, opciones] = fetch.mock.calls[1];
    expect(url).toBe(`${URL_API}/ia/solicitudes/4/transcripcion?consentimiento=si&nombre=transcripcion.txt&origen=texto`);
    expect(opciones.body).toBeInstanceOf(Blob);
    expect(opciones.body.size).toBe('Entrevistadora: hola'.length);
    expect(opciones.headers['Content-Type']).toMatch(/^text\/plain/);
  });

  it('useEstadoIa informa si la voz está disponible', async () => {
    const conVoz = { conectado: () => true, estado: vi.fn().mockResolvedValue({ disponible: true, voz: true }) };
    const { result } = renderHook(() => useEstadoIa(conVoz));
    expect(result.current).toEqual({ disponible: false, voz: false });
    await waitFor(() => expect(result.current).toEqual({ disponible: true, voz: true }));
  });
});
