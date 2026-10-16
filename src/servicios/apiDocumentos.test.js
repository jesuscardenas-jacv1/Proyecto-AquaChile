import { vi } from 'vitest';
import {
  URL_API,
  conectarApi,
  desconectarApi,
  eliminarDocumento,
  listarDocumentos,
  obtenerToken,
  subirDocumento,
} from './apiDocumentos';

const respuestaJson = (datos, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(datos), { status }));

describe('apiDocumentos', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('guarda el token del backend al conectar y lo borra al desconectar', async () => {
    fetch.mockReturnValue(respuestaJson({ token: 'jwt-1' }));

    expect(await conectarApi('analista@aquachile.cl', 'clave')).toBe(true);
    expect(fetch).toHaveBeenCalledWith(`${URL_API}/auth/login`, expect.objectContaining({ method: 'POST' }));
    expect(obtenerToken()).toBe('jwt-1');

    desconectarApi();
    expect(obtenerToken()).toBeNull();
  });

  it('no falla si el backend no está levantado', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await conectarApi('a@aquachile.cl', 'x')).toBe(false);
    expect(obtenerToken()).toBeNull();
  });

  it('sin token informa que el servicio no está disponible, sin llamar al backend', async () => {
    await expect(listarDocumentos(1)).rejects.toMatchObject({ noDisponible: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('lista con el token en la cabecera', async () => {
    sessionStorage.setItem('aquachile_token_api', 'jwt-2');
    fetch.mockReturnValue(respuestaJson({ archivos: [] }));

    expect(await listarDocumentos(5)).toEqual({ archivos: [] });
    expect(fetch).toHaveBeenCalledWith(
      `${URL_API}/solicitudes/5/documentos`,
      expect.objectContaining({ headers: { Authorization: 'Bearer jwt-2' } }),
    );
  });

  it('sube el archivo con su categoría, nombre y el candidato codificado', async () => {
    sessionStorage.setItem('aquachile_token_api', 'jwt-2');
    fetch.mockReturnValue(respuestaJson({ ok: true }, 201));
    const archivo = new File(['pdf'], 'mi cv.pdf', { type: 'application/pdf' });

    await subirDocumento(5, { categoria: 'cv', archivo, nombreCandidato: 'Ana Pérez' });

    const [url, opciones] = fetch.mock.calls[0];
    expect(url).toBe(`${URL_API}/solicitudes/5/documentos?categoria=cv&nombre=mi+cv.pdf`);
    expect(opciones.method).toBe('POST');
    expect(opciones.body).toBe(archivo);
    expect(opciones.headers['X-Candidato']).toBe('Ana%20P%C3%A9rez');
  });

  it('propaga el mensaje de error y descarta el token vencido', async () => {
    sessionStorage.setItem('aquachile_token_api', 'jwt-viejo');
    fetch.mockReturnValue(respuestaJson({ error: 'Token inválido o expirado.' }, 401));

    await expect(eliminarDocumento(5, 'CV - a.pdf')).rejects.toMatchObject({
      message: 'Token inválido o expirado.',
      status: 401,
      noDisponible: true,
    });
    expect(fetch.mock.calls[0][0]).toBe(`${URL_API}/solicitudes/5/documentos/CV%20-%20a.pdf`);
    expect(obtenerToken()).toBeNull();
  });
});
