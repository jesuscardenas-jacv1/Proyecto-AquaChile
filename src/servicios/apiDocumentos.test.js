import { vi } from 'vitest';
import {
  URL_API,
  conectarApi,
  desconectarApi,
  eliminarDocumento,
  generarInforme,
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

  it('genera el informe enviando solo el dictamen, nunca las observaciones clínicas', async () => {
    sessionStorage.setItem('aquachile_token_api', 'jwt-2');
    fetch.mockReturnValue(respuestaJson({ ok: true }, 201));

    await generarInforme(5, {
      candidato: { id: 1, nombre: 'Ana Pérez', correo: 'ana@correo.cl', telefono: '+569', origen: 'Interno' },
      solicitud: { id: 5, cargo: 'Jefe de Centro', familiaCargo: 'Jefatura', fechaSolicitud: '2026-10-01' },
      evaluacion: { fechaEvaluacion: '2026-10-10', resultado: 'Recomendado', observaciones: 'Nota clínica' },
    });

    const [url, opciones] = fetch.mock.calls[0];
    expect(url).toBe(`${URL_API}/solicitudes/5/documentos/informe`);
    expect(opciones.method).toBe('POST');
    expect(opciones.headers['Content-Type']).toBe('application/json');
    const cuerpo = JSON.parse(opciones.body);
    expect(cuerpo.evaluacion).toEqual({ fechaEvaluacion: '2026-10-10', resultado: 'Recomendado', competencias: [] });
    expect(cuerpo.candidato.nombre).toBe('Ana Pérez');
    expect(opciones.body).not.toContain('Nota clínica');
  });
});
