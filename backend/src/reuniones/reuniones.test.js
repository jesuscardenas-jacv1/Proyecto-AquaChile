/**
 * Pruebas de las reuniones online (Google Calendar + Meet y Microsoft Graph + Teams) con
 * un `fetch` simulado: no se llama a Google ni a Microsoft.
 * Ejecutar con: npm run test:reuniones
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ReunionesGoogle, ALCANCE_CALENDAR } = require('./google');
const { ReunionesGraph } = require('./graph');
const { horario, validarEnlaceReunion } = require('./comun');
const { crearReuniones, sincronizarReunion, cancelarReunion } = require('./index');

/** Respuesta mínima compatible con fetch. */
const respuesta = (status, cuerpo) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => cuerpo,
});

/** fetch simulado: registra las llamadas y responde según `responder(url, opciones)`. */
function fetchSimulado(responder) {
  const llamadas = [];
  const fetch = async (url, opciones = {}) => {
    const llamada = { url, metodo: opciones.method, cuerpo: opciones.body, cabeceras: opciones.headers };
    llamadas.push(llamada);
    return responder(llamada);
  };
  return { fetch, llamadas };
}

const TOKEN_GOOGLE = respuesta(200, {
  access_token: 'token-falso',
  expires_in: 3600,
  scope: `https://www.googleapis.com/auth/drive.file ${ALCANCE_CALENDAR}`,
});

describe('comun', () => {
  it('calcula inicio y término en hora local, también al cruzar la medianoche', () => {
    assert.deepEqual(horario('2026-12-01', '10:30'), { inicio: '2026-12-01T10:30:00', termino: '2026-12-01T11:30:00' });
    assert.equal(horario('2026-12-31', '23:30').termino, '2027-01-01T00:30:00');
  });

  it('acepta solo enlaces https de Meet o Teams', () => {
    assert.equal(validarEnlaceReunion('https://meet.google.com/abc-defg-hij'), 'https://meet.google.com/abc-defg-hij');
    assert.ok(validarEnlaceReunion('https://teams.microsoft.com/l/meetup-join/19%3ameeting_x'));
    assert.ok(validarEnlaceReunion('https://teams.live.com/meet/9876'));
    assert.equal(validarEnlaceReunion('http://meet.google.com/abc'), null);
    assert.equal(validarEnlaceReunion('https://meet.google.com.malo.cl/abc'), null);
    assert.equal(validarEnlaceReunion('https://zoom.us/j/123'), null);
    assert.equal(validarEnlaceReunion('javascript:alert(1)'), null);
    assert.equal(validarEnlaceReunion('https://usuario:clave@teams.microsoft.com/x'), null);
    assert.equal(validarEnlaceReunion(''), null);
  });
});

describe('ReunionesGoogle', () => {
  const crear = (fetch) =>
    new ReunionesGoogle({ clientId: 'id', clientSecret: 'secreto', refreshToken: 'refresh', fetch });

  it('exige credenciales', () => {
    assert.throws(() => new ReunionesGoogle({ clientId: 'id', clientSecret: 's' }), /autorización/);
  });

  it('crea el evento con Meet, zona America/Santiago y sin invitados', async () => {
    const { fetch, llamadas } = fetchSimulado(({ url }) =>
      url.includes('oauth2') ? TOKEN_GOOGLE : respuesta(200, { id: 'evento-1', hangoutLink: 'https://meet.google.com/aaa-bbbb-ccc' }),
    );
    const resultado = await crear(fetch).guardarEvento({
      titulo: 'Entrevista psicolaboral: Ana Prueba · Operario',
      fecha: '2026-12-01',
      hora: '10:00',
    });

    assert.deepEqual(resultado, { eventoId: 'evento-1', enlace: 'https://meet.google.com/aaa-bbbb-ccc' });
    const evento = llamadas[1];
    assert.equal(evento.metodo, 'POST');
    assert.match(evento.url, /calendars\/primary\/events\?conferenceDataVersion=1$/);
    const cuerpo = JSON.parse(evento.cuerpo);
    assert.equal(cuerpo.start.timeZone, 'America/Santiago');
    assert.equal(cuerpo.start.dateTime, '2026-12-01T10:00:00');
    assert.equal(cuerpo.end.dateTime, '2026-12-01T11:00:00');
    assert.equal(cuerpo.conferenceData.createRequest.conferenceSolutionKey.type, 'hangoutsMeet');
    assert.equal(cuerpo.attendees, undefined);
    assert.equal(evento.cabeceras.Authorization, 'Bearer token-falso');
  });

  it('al reagendar actualiza el evento existente (PATCH) sin crear otro', async () => {
    const { fetch, llamadas } = fetchSimulado(({ url }) =>
      url.includes('oauth2') ? TOKEN_GOOGLE : respuesta(200, { id: 'evento-1', hangoutLink: 'https://meet.google.com/aaa' }),
    );
    await crear(fetch).guardarEvento({ eventoId: 'evento-1', titulo: 'x', fecha: '2026-12-02', hora: '15:00' });
    assert.equal(llamadas.length, 2);
    assert.equal(llamadas[1].metodo, 'PATCH');
    assert.match(llamadas[1].url, /events\/evento-1\?/);
  });

  it('si el evento se borró en Calendar crea uno nuevo', async () => {
    const { fetch, llamadas } = fetchSimulado(({ url, metodo }) => {
      if (url.includes('oauth2')) return TOKEN_GOOGLE;
      if (metodo === 'PATCH') return respuesta(404, {});
      return respuesta(200, { id: 'evento-2', hangoutLink: 'https://meet.google.com/nuevo' });
    });
    const resultado = await crear(fetch).guardarEvento({ eventoId: 'borrado', titulo: 'x', fecha: '2026-12-02', hora: '15:00' });
    assert.equal(resultado.eventoId, 'evento-2');
    assert.deepEqual(llamadas.slice(1).map((l) => l.metodo), ['PATCH', 'POST']);
  });

  it('sin el alcance de Calendar avisa sin llamar a la API', async () => {
    const { fetch, llamadas } = fetchSimulado(() =>
      respuesta(200, { access_token: 't', expires_in: 3600, scope: 'https://www.googleapis.com/auth/drive.file' }),
    );
    await assert.rejects(crear(fetch).guardarEvento({ titulo: 'x', fecha: '2026-12-01', hora: '10:00' }), (error) => {
      assert.equal(error.sinPermiso, true);
      assert.match(error.message, /drive:autorizar/);
      return true;
    });
    assert.equal(llamadas.length, 1);
  });

  it('un 403 de Calendar se informa como falta de permiso', async () => {
    const { fetch } = fetchSimulado(({ url }) =>
      url.includes('oauth2')
        ? respuesta(200, { access_token: 't', expires_in: 3600 })
        : respuesta(403, { error: { message: 'Request had insufficient authentication scopes.' } }),
    );
    await assert.rejects(crear(fetch).guardarEvento({ titulo: 'x', fecha: '2026-12-01', hora: '10:00' }), { sinPermiso: true });
  });

  it('si la API de Calendar no está habilitada lo dice', async () => {
    const { fetch } = fetchSimulado(({ url }) =>
      url.includes('oauth2')
        ? TOKEN_GOOGLE
        : respuesta(403, { error: { message: 'Calendar API has not been used in project 1', errors: [{ reason: 'accessNotConfigured' }] } }),
    );
    await assert.rejects(crear(fetch).guardarEvento({ titulo: 'x', fecha: '2026-12-01', hora: '10:00' }), (error) => {
      assert.match(error.message, /no está habilitada/);
      assert.equal(error.sinPermiso, false);
      return true;
    });
  });

  it('cancelar borra el evento y no falla si ya no existe', async () => {
    const { fetch, llamadas } = fetchSimulado(({ url }) => (url.includes('oauth2') ? TOKEN_GOOGLE : respuesta(410, {})));
    await crear(fetch).cancelarEvento('evento-1');
    assert.equal(llamadas[1].metodo, 'DELETE');
    assert.match(llamadas[1].url, /events\/evento-1$/);
  });
});

describe('ReunionesGraph (Teams)', () => {
  const crear = (fetch) =>
    new ReunionesGraph({ tenantId: 't', clientId: 'c', clientSecret: 's', usuario: 'reclutamiento@ejemplo.cl', fetch });

  it('exige el buzón organizador', () => {
    assert.throws(() => new ReunionesGraph({ tenantId: 't', clientId: 'c', clientSecret: 's' }), /GRAPH_REUNIONES_USUARIO/);
  });

  it('crea el evento con reunión de Teams y devuelve el joinUrl', async () => {
    const { fetch, llamadas } = fetchSimulado(({ url }) =>
      url.includes('login.microsoftonline.com')
        ? respuesta(200, { access_token: 'token-graph', expires_in: 3600 })
        : respuesta(201, { id: 'ev-teams', onlineMeeting: { joinUrl: 'https://teams.microsoft.com/l/meetup-join/1' } }),
    );
    const resultado = await crear(fetch).guardarEvento({ titulo: 'Entrevista', fecha: '2026-12-01', hora: '09:00' });
    assert.deepEqual(resultado, { eventoId: 'ev-teams', enlace: 'https://teams.microsoft.com/l/meetup-join/1' });
    const cuerpo = JSON.parse(llamadas[1].cuerpo);
    assert.equal(cuerpo.isOnlineMeeting, true);
    assert.equal(cuerpo.onlineMeetingProvider, 'teamsForBusiness');
    assert.equal(cuerpo.start.timeZone, 'America/Santiago');
    assert.match(llamadas[1].url, /users\/reclutamiento%40ejemplo\.cl\/events$/);
  });

  it('sin permiso aprobado lo informa', async () => {
    const { fetch } = fetchSimulado(({ url }) =>
      url.includes('login') ? respuesta(200, { access_token: 't' }) : respuesta(403, { error: { message: 'Forbidden' } }),
    );
    await assert.rejects(crear(fetch).guardarEvento({ titulo: 'x', fecha: '2026-12-01', hora: '09:00' }), /Calendars\.ReadWrite/);
  });

  it('cancela la reunión', async () => {
    const { fetch, llamadas } = fetchSimulado(({ url }) =>
      url.includes('login') ? respuesta(200, { access_token: 't' }) : respuesta(202, null),
    );
    await crear(fetch).cancelarEvento('ev-teams');
    assert.match(llamadas[1].url, /events\/ev-teams\/cancel$/);
  });
});

describe('crearReuniones (configuración)', () => {
  it('sin credenciales Google queda desactivado con su motivo; Teams es manual por defecto', () => {
    const reuniones = crearReuniones({ GDRIVE_TOKEN_ARCHIVO: '/no/existe.json' });
    assert.equal(reuniones.google, null);
    assert.match(reuniones.motivos.google, /no está configurado/);
    assert.equal(reuniones.teams, null);
  });

  it('con credenciales activa Google y con REUNIONES_TEAMS=graph activa Teams', () => {
    const reuniones = crearReuniones({
      GDRIVE_CLIENT_ID: 'id',
      GDRIVE_CLIENT_SECRET: 's',
      GDRIVE_REFRESH_TOKEN: 'r',
      REUNIONES_TEAMS: 'graph',
      GRAPH_TENANT_ID: 't',
      GRAPH_CLIENT_ID: 'c',
      GRAPH_CLIENT_SECRET: 's',
      GRAPH_REUNIONES_USUARIO: 'reclutamiento@ejemplo.cl',
    });
    assert.equal(reuniones.google.proveedor, 'google');
    assert.equal(reuniones.teams.proveedor, 'graph');
  });

  it('REUNIONES_GOOGLE=no lo desactiva', () => {
    const reuniones = crearReuniones({ REUNIONES_GOOGLE: 'no', GDRIVE_CLIENT_ID: 'id', GDRIVE_CLIENT_SECRET: 's', GDRIVE_REFRESH_TOKEN: 'r' });
    assert.equal(reuniones.google, null);
  });
});

describe('sincronizarReunion', () => {
  /** Proveedor simulado que registra lo que se le pide. */
  const simulado = (nombre, { falla = false } = {}) => {
    const registro = { guardados: [], cancelados: [] };
    return {
      registro,
      proveedor: {
        proveedor: nombre,
        guardarEvento: async (datos) => {
          if (falla) throw new Error('Calendar no responde');
          registro.guardados.push(datos);
          return { eventoId: datos.eventoId ?? `ev-${registro.guardados.length}`, enlace: `https://meet.google.com/${registro.guardados.length}` };
        },
        cancelarEvento: async (id) => registro.cancelados.push(id),
      },
    };
  };
  const base = { id: 1, enlace_reunion: '', evento_reunion_id: '', proveedor_reunion: '', modalidad_entrevista: '' };
  const agendaMeet = { fecha: '2026-12-01', hora: '10:00', modalidad: 'Google Meet' };

  it('Google Meet crea el evento y guarda su id', async () => {
    const { proveedor, registro } = simulado('google');
    const r = await sincronizarReunion({ actual: base, etapa: 'agendada', agenda: agendaMeet, agendando: true, titulo: 'T' }, { google: proveedor, motivos: {} });
    assert.deepEqual(r, { enlace: 'https://meet.google.com/1', eventoId: 'ev-1', proveedor: 'google', aviso: null });
    assert.equal(registro.guardados[0].eventoId, null);
  });

  it('al reagendar reutiliza el evento', async () => {
    const { proveedor, registro } = simulado('google');
    const actual = { ...base, enlace_reunion: 'https://meet.google.com/x', evento_reunion_id: 'ev-9', proveedor_reunion: 'google' };
    const r = await sincronizarReunion({ actual, etapa: 'agendada', agenda: agendaMeet, agendando: true }, { google: proveedor, motivos: {} });
    assert.equal(registro.guardados[0].eventoId, 'ev-9');
    assert.equal(r.eventoId, 'ev-9');
  });

  it('sin proveedor de Google la agenda sigue y trae un aviso', async () => {
    const r = await sincronizarReunion(
      { actual: base, etapa: 'agendada', agenda: agendaMeet, agendando: true },
      { google: null, motivos: { google: 'Falta autorizar.' } },
    );
    assert.equal(r.enlace, '');
    assert.match(r.aviso, /no se creó el enlace.*Falta autorizar/);
  });

  it('si Calendar falla conserva el evento anterior y avisa', async () => {
    const { proveedor } = simulado('google', { falla: true });
    const actual = { ...base, enlace_reunion: 'https://meet.google.com/x', evento_reunion_id: 'ev-9', proveedor_reunion: 'google' };
    const r = await sincronizarReunion({ actual, etapa: 'agendada', agenda: agendaMeet, agendando: true }, { google: proveedor, motivos: {} });
    assert.equal(r.enlace, 'https://meet.google.com/x');
    assert.match(r.aviso, /Calendar no responde/);
  });

  it('pasar de Meet a Presencial cancela el evento y borra el enlace', async () => {
    const { proveedor, registro } = simulado('google');
    const actual = { ...base, enlace_reunion: 'https://meet.google.com/x', evento_reunion_id: 'ev-9', proveedor_reunion: 'google' };
    const r = await sincronizarReunion(
      { actual, etapa: 'agendada', agenda: { ...agendaMeet, modalidad: 'Presencial' }, agendando: true },
      { google: proveedor, motivos: {} },
    );
    assert.deepEqual(registro.cancelados, ['ev-9']);
    assert.deepEqual([r.enlace, r.eventoId, r.proveedor], ['', '', '']);
  });

  it('Teams manual guarda el enlace pegado y lo mantiene si no se envía', async () => {
    const teams = { ...agendaMeet, modalidad: 'Teams' };
    const pegado = await sincronizarReunion(
      { actual: base, etapa: 'agendada', agenda: teams, agendando: true, enlacePegado: 'https://teams.microsoft.com/l/1' },
      { motivos: {} },
    );
    assert.equal(pegado.enlace, 'https://teams.microsoft.com/l/1');
    const actual = { ...base, modalidad_entrevista: 'Teams', enlace_reunion: 'https://teams.microsoft.com/l/1' };
    const sinEnviar = await sincronizarReunion({ actual, etapa: 'agendada', agenda: teams, agendando: true }, { motivos: {} });
    assert.equal(sinEnviar.enlace, 'https://teams.microsoft.com/l/1');
  });

  it('marcar realizada no toca la reunión; volver a recibida la cancela', async () => {
    const { proveedor, registro } = simulado('google');
    const actual = { ...base, enlace_reunion: 'https://meet.google.com/x', evento_reunion_id: 'ev-9', proveedor_reunion: 'google' };
    const realizada = await sincronizarReunion({ actual, etapa: 'realizada', agenda: agendaMeet, agendando: false }, { google: proveedor, motivos: {} });
    assert.equal(realizada.enlace, 'https://meet.google.com/x');
    const recibida = await sincronizarReunion({ actual, etapa: 'recibida', agenda: {}, agendando: false }, { google: proveedor, motivos: {} });
    assert.equal(recibida.enlace, '');
    assert.deepEqual(registro.cancelados, ['ev-9']);
  });

  it('cancelarReunion avisa si el proveedor ya no está configurado', async () => {
    const actual = { ...base, evento_reunion_id: 'ev-9', proveedor_reunion: 'google' };
    assert.match(await cancelarReunion(actual, { google: null, motivos: {} }), /Bórrelo a mano/);
    assert.equal(await cancelarReunion(base, { motivos: {} }), null);
  });
});
