import { describe, expect, it, vi } from 'vitest';
import { crearServicioApi } from './servicioApi';
import { ErrorApi, mensajeDeError } from './errores';
import { EVENTO_SESION_EXPIRADA } from './sesion';

/** Respuesta HTTP simulada. */
const respuesta = (status, cuerpo) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => cuerpo,
});

function crearServicio(respuestas, token = 'jwt-123') {
  const fetch = vi.fn();
  respuestas.forEach((r) => fetch.mockResolvedValueOnce(r));
  const servicio = crearServicioApi({ urlBase: '/api', obtenerToken: () => token, fetch });
  return { servicio, fetch };
}

describe('servicioApi', () => {
  it('inicia sesión con POST /auth/login y devuelve usuario y token', async () => {
    const { servicio, fetch } = crearServicio(
      [respuesta(200, { usuario: { id: 1, rol: 'analista' }, token: 'nuevo' })],
      null,
    );

    const sesion = await servicio.iniciarSesion('analista@aquachile.cl', 'clave');

    expect(sesion).toEqual({ usuario: { id: 1, rol: 'analista' }, token: 'nuevo' });
    const [url, opciones] = fetch.mock.calls[0];
    expect(url).toBe('/api/auth/login');
    expect(opciones.method).toBe('POST');
    expect(JSON.parse(opciones.body)).toEqual({ correo: 'analista@aquachile.cl', contrasena: 'clave' });
    expect(opciones.headers.Authorization).toBeUndefined();
  });

  it('envía el JWT y carga candidatos, solicitudes y evaluaciones', async () => {
    const { servicio, fetch } = crearServicio([
      respuesta(200, { candidatos: [{ id: 1 }] }),
      respuesta(200, { solicitudes: [{ id: 2 }] }),
      respuesta(200, { evaluaciones: [{ id: 3 }] }),
    ]);

    const datos = await servicio.cargarDatos();

    expect(datos).toEqual({
      candidatos: [{ id: 1 }],
      solicitudes: [{ id: 2 }],
      evaluaciones: [{ id: 3 }],
    });
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/candidatos',
      '/api/solicitudes',
      '/api/evaluaciones',
    ]);
    fetch.mock.calls.forEach(([, opciones]) =>
      expect(opciones.headers.Authorization).toBe('Bearer jwt-123'),
    );
  });

  it('usa el método y la ruta de cada operación', async () => {
    const { servicio, fetch } = crearServicio([
      respuesta(201, { candidato: { id: 9 } }),
      respuesta(200, { candidato: { id: 9 } }),
      respuesta(200, { ok: true }),
      respuesta(201, { solicitud: { id: 7 } }),
      respuesta(200, { solicitud: { id: 7 } }),
      respuesta(200, { solicitud: { id: 7, etapa: 'agendada' } }),
    ]);

    await servicio.crearCandidato({ nombre: 'Ana' });
    await servicio.actualizarCandidato(9, { cargo: 'X' });
    await servicio.eliminarCandidato(9);
    await servicio.crearSolicitud({ candidatoId: 9 });
    await servicio.actualizarSolicitud(7, { estado: 'En proceso' });
    const movida = await servicio.moverEtapa(7, 'agendada', { horaEntrevista: '10:00' });

    expect(fetch.mock.calls.map(([url, o]) => `${o.method} ${url}`)).toEqual([
      'POST /api/candidatos',
      'PUT /api/candidatos/9',
      'DELETE /api/candidatos/9',
      'POST /api/solicitudes',
      'PATCH /api/solicitudes/7/estado',
      'PATCH /api/solicitudes/7/etapa',
    ]);
    expect(JSON.parse(fetch.mock.calls[5][1].body)).toEqual({ etapa: 'agendada', horaEntrevista: '10:00' });
    expect(movida.etapa).toBe('agendada');
  });

  it('crea la evaluación con POST (o la actualiza con PUT) y vuelve a leer la solicitud', async () => {
    const datos = { fechaEvaluacion: '2026-01-10', resultado: 'Recomendado', observaciones: 'Muy buen perfil.', estado: 'Realizada' };
    const { servicio, fetch } = crearServicio([
      respuesta(201, { evaluacion: { id: 5 } }),
      respuesta(200, { solicitud: { id: 7, estado: 'Finalizada' } }),
      respuesta(200, { evaluacion: { id: 5 } }),
      respuesta(200, { solicitud: { id: 7, estado: 'Finalizada' } }),
    ]);

    const creada = await servicio.registrarEvaluacion(7, datos);
    await servicio.registrarEvaluacion(7, datos, { id: 5 });

    expect(creada).toEqual({ evaluacion: { id: 5 }, solicitud: { id: 7, estado: 'Finalizada' } });
    expect(fetch.mock.calls.map(([url, o]) => `${o.method} ${url}`)).toEqual([
      'POST /api/evaluaciones',
      'GET /api/solicitudes/7',
      'PUT /api/evaluaciones/5',
      'GET /api/solicitudes/7',
    ]);
    // El estado de la evaluación no se envía: lo decide la API
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      solicitudId: 7,
      fechaEvaluacion: '2026-01-10',
      resultado: 'Recomendado',
      observaciones: 'Muy buen perfil.',
    });
  });

  it('convierte los errores de la API en ErrorApi con el detalle por campo', async () => {
    const { servicio } = crearServicio([
      respuesta(400, {
        error: 'Los datos enviados no son válidos.',
        errores: { correo: 'El correo no tiene un formato válido.' },
      }),
    ]);

    const error = await servicio.crearCandidato({}).catch((e) => e);

    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.status).toBe(400);
    expect(error.errores.correo).toMatch(/correo/);
    expect(mensajeDeError(error)).toBe(
      'Los datos enviados no son válidos. El correo no tiene un formato válido.',
    );
  });

  it('avisa que la sesión expiró cuando la API rechaza el token (401)', async () => {
    const alExpirar = vi.fn();
    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
    const { servicio } = crearServicio([respuesta(401, { error: 'Token inválido o expirado.' })]);

    const error = await servicio.eliminarCandidato(1).catch((e) => e);

    expect(error.status).toBe(401);
    expect(alExpirar).toHaveBeenCalledTimes(1);
    window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
  });

  it('un login fallido (401 sin token) no se trata como sesión expirada', async () => {
    const alExpirar = vi.fn();
    window.addEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
    const { servicio } = crearServicio([respuesta(401, { error: 'Credenciales inválidas.' })], null);

    const error = await servicio.iniciarSesion('a@b.cl', 'mala').catch((e) => e);

    expect(error.message).toBe('Credenciales inválidas.');
    expect(alExpirar).not.toHaveBeenCalled();
    window.removeEventListener(EVENTO_SESION_EXPIRADA, alExpirar);
  });

  it('informa cuando no puede conectar con el servidor (status 0)', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const servicio = crearServicioApi({ obtenerToken: () => null, fetch });

    const error = await servicio.cargarDatos().catch((e) => e);

    expect(error.status).toBe(0);
    expect(error.message).toMatch(/No se pudo conectar/);
  });

  it('mantiene un mensaje útil si la respuesta de error no trae JSON', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('no es JSON');
      },
    });
    const servicio = crearServicioApi({ obtenerToken: () => null, fetch });

    const error = await servicio.crearSolicitud({}).catch((e) => e);
    expect(error.message).toBe('La API respondió con un error (502).');
  });
});
