/**
 * Pruebas automatizadas de la API REST de AquaChile (node:test + node:assert).
 *
 * - Trabajan sobre una base SQLite TEMPORAL (variable AQUACHILE_BD), así que nunca
 *   modifican backend/datos.sqlite.
 * - Si una prueba falla, el proceso termina con código distinto de 0 (útil para CI).
 *
 * Ejecutar con: npm test (dentro de backend/)
 */
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dirTemporal = fs.mkdtempSync(path.join(os.tmpdir(), 'aquachile-api-'));
process.env.AQUACHILE_BD = path.join(dirTemporal, 'pruebas.sqlite');

const { migrar } = require('./bd/migrar');
const { sembrar } = require('./bd/semilla');
const app = require('./servidor');
const rutaAuth = require('./rutas/auth');
const db = require('./bd/conexion');

let servidor;
let URL_BASE;
let tokenAnalista;
let tokenEvaluador;

async function pedir(metodo, ruta, { token, cuerpo } = {}) {
  const respuesta = await fetch(`${URL_BASE}${ruta}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(cuerpo !== undefined && { body: JSON.stringify(cuerpo) }),
  });
  const texto = await respuesta.text();
  return { status: respuesta.status, datos: texto ? JSON.parse(texto) : null };
}

async function login(correo, contrasena = 'AquaChile2026!') {
  return pedir('POST', '/auth/login', { cuerpo: { correo, contrasena } });
}

/** Crea un candidato y una solicitud nuevos (Pendiente) y devuelve sus ids. */
async function crearSolicitudPendiente() {
  const candidato = await pedir('POST', '/candidatos', {
    token: tokenAnalista,
    cuerpo: {
      nombre: 'Candidata Prueba',
      correo: `prueba.${Date.now()}.${Math.random()}@correo.cl`,
      telefono: '+56911112222',
      cargo: 'Operario de Planta',
      familiaCargo: 'Operario',
    },
  });
  assert.equal(candidato.status, 201);
  const solicitud = await pedir('POST', '/solicitudes', {
    token: tokenAnalista,
    cuerpo: {
      candidatoId: candidato.datos.candidato.id,
      cargo: 'Operario de Planta',
      familiaCargo: 'Operario',
      fechaSolicitud: '2026-01-05',
    },
  });
  assert.equal(solicitud.status, 201);
  return { candidatoId: candidato.datos.candidato.id, solicitudId: solicitud.datos.solicitud.id };
}

const evaluacionValida = {
  resultado: 'Recomendado',
  observaciones: 'Perfil consistente con el cargo y buena disposición.',
  fechaEvaluacion: '2026-01-10',
};

before(async () => {
  migrar();
  sembrar({ silencioso: true });
  await new Promise((resolver) => {
    servidor = app.listen(0, resolver);
  });
  URL_BASE = `http://127.0.0.1:${servidor.address().port}/api`;

  tokenAnalista = (await login('analista@aquachile.cl')).datos.token;
  tokenEvaluador = (await login('evaluador@aquachile.cl')).datos.token;
});

beforeEach(() => rutaAuth.reiniciarIntentos());

after(() => {
  servidor.close();
  db.close();
  fs.rmSync(dirTemporal, { recursive: true, force: true });
});

/* --------------------------------- Salud ---------------------------------- */

test('healthcheck responde 200 y estado operativo', async () => {
  const { status, datos } = await pedir('GET', '/salud');
  assert.equal(status, 200);
  assert.equal(datos.estado, 'operativo');
});

test('ruta inexistente responde 404', async () => {
  const { status } = await pedir('GET', '/no-existe');
  assert.equal(status, 404);
});

test('JSON mal formado responde 400 (no 500)', async () => {
  const respuesta = await fetch(`${URL_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"correo": ',
  });
  assert.equal(respuesta.status, 400);
});

/* ---------------------------------- Auth ---------------------------------- */

test('login de analista y evaluador entrega JWT con el rol correcto', async () => {
  const analista = await login('analista@aquachile.cl');
  assert.equal(analista.status, 200);
  assert.ok(analista.datos.token);
  assert.equal(analista.datos.usuario.rol, 'analista');
  assert.equal(analista.datos.usuario.contrasena_hash, undefined);

  const evaluador = await login('ignacia.valdes@aquachile.cl');
  assert.equal(evaluador.status, 200);
  assert.equal(evaluador.datos.usuario.rol, 'evaluador');
});

test('credenciales incorrectas responden 401', async () => {
  const { status } = await login('analista@aquachile.cl', 'incorrecta');
  assert.equal(status, 401);
});

test('login con tipos inválidos responde 400 (no 500)', async () => {
  const { status } = await pedir('POST', '/auth/login', { cuerpo: { correo: 123, contrasena: [] } });
  assert.equal(status, 400);
});

test('tras 5 intentos fallidos el login se bloquea (429)', async () => {
  for (let i = 0; i < 5; i += 1) {
    assert.equal((await login('evaluador@aquachile.cl', 'mala')).status, 401);
  }
  assert.equal((await login('evaluador@aquachile.cl')).status, 429);
});

test('sin token o con token inválido responde 401', async () => {
  assert.equal((await pedir('GET', '/candidatos')).status, 401);
  assert.equal((await pedir('GET', '/candidatos', { token: 'no-es-un-jwt' })).status, 401);
});

test('perfil devuelve al usuario autenticado', async () => {
  const { status, datos } = await pedir('GET', '/auth/perfil', { token: tokenAnalista });
  assert.equal(status, 200);
  assert.equal(datos.usuario.correo, 'carolina.munoz@aquachile.cl');
});

/* ------------------------------- Candidatos ------------------------------- */

test('lista los 100 candidatos de la base simulada', async () => {
  const { status, datos } = await pedir('GET', '/candidatos', { token: tokenAnalista });
  assert.equal(status, 200);
  assert.ok(datos.total >= 100);
});

test('evaluador no puede crear candidatos (403)', async () => {
  const { status } = await pedir('POST', '/candidatos', { token: tokenEvaluador, cuerpo: {} });
  assert.equal(status, 403);
});

test('crear candidato con datos inválidos responde 400 con detalle por campo', async () => {
  const { status, datos } = await pedir('POST', '/candidatos', {
    token: tokenAnalista,
    cuerpo: { nombre: 'Al', correo: 'no-es-correo', telefono: '12', cargo: '', familiaCargo: '' },
  });
  assert.equal(status, 400);
  assert.deepEqual(Object.keys(datos.errores).sort(), [
    'cargo',
    'correo',
    'familiaCargo',
    'nombre',
    'telefono',
  ]);
});

test('analista crea, edita y elimina un candidato sin solicitudes', async () => {
  const creado = await pedir('POST', '/candidatos', {
    token: tokenAnalista,
    cuerpo: {
      nombre: 'Candidato Test API',
      correo: 'Test.API@AquaChile.cl',
      telefono: '+56999887766',
      cargo: 'Jefe de Centro Cultivo',
      familiaCargo: 'Jefatura',
    },
  });
  assert.equal(creado.status, 201);
  assert.equal(creado.datos.candidato.correo, 'test.api@aquachile.cl');
  const id = creado.datos.candidato.id;

  const editado = await pedir('PUT', `/candidatos/${id}`, {
    token: tokenAnalista,
    cuerpo: { cargo: 'Jefe de Centro' },
  });
  assert.equal(editado.status, 200);
  assert.equal(editado.datos.candidato.cargo, 'Jefe de Centro');

  const editadoInvalido = await pedir('PUT', `/candidatos/${id}`, {
    token: tokenAnalista,
    cuerpo: { correo: 'malo' },
  });
  assert.equal(editadoInvalido.status, 400);

  assert.equal((await pedir('DELETE', `/candidatos/${id}`, { token: tokenAnalista })).status, 200);
  assert.equal((await pedir('GET', `/candidatos/${id}`, { token: tokenAnalista })).status, 404);
});

test('no se elimina un candidato con solicitudes (409)', async () => {
  const { status } = await pedir('DELETE', '/candidatos/1', { token: tokenAnalista });
  assert.equal(status, 409);
});

test('id no numérico responde 400', async () => {
  assert.equal((await pedir('GET', '/candidatos/abc', { token: tokenAnalista })).status, 400);
  assert.equal((await pedir('GET', '/solicitudes/1.5', { token: tokenAnalista })).status, 400);
});

/* ------------------------------- Solicitudes ------------------------------ */

test('lista las 100 solicitudes de la base simulada', async () => {
  const { status, datos } = await pedir('GET', '/solicitudes?estado=Finalizada', {
    token: tokenAnalista,
  });
  assert.equal(status, 200);
  assert.equal(datos.total, 100);
});

test('regla de confidencialidad: el analista no recibe observaciones clínicas', async () => {
  const analista = await pedir('GET', '/solicitudes/1', { token: tokenAnalista });
  assert.equal(analista.datos.evaluacion.observaciones, undefined);
  assert.equal(analista.datos.evaluacion.confidencial, true);

  const evaluador = await pedir('GET', '/solicitudes/1', { token: tokenEvaluador });
  assert.equal(typeof evaluador.datos.evaluacion.observaciones, 'string');
  assert.equal(evaluador.datos.evaluacion.confidencial, false);
});

test('crear solicitud valida datos y candidato existente', async () => {
  const sinDatos = await pedir('POST', '/solicitudes', { token: tokenAnalista, cuerpo: {} });
  assert.equal(sinDatos.status, 400);

  const fechaFutura = await pedir('POST', '/solicitudes', {
    token: tokenAnalista,
    cuerpo: { candidatoId: 1, cargo: 'X', familiaCargo: 'Operario', fechaSolicitud: '2999-01-01' },
  });
  assert.equal(fechaFutura.status, 400);

  const candidatoInexistente = await pedir('POST', '/solicitudes', {
    token: tokenAnalista,
    cuerpo: { candidatoId: 99999, cargo: 'X', familiaCargo: 'Operario' },
  });
  assert.equal(candidatoInexistente.status, 404);
});

test('una solicitud no puede finalizarse sin evaluación (409)', async () => {
  const { solicitudId } = await crearSolicitudPendiente();
  const { status } = await pedir('PATCH', `/solicitudes/${solicitudId}/estado`, {
    token: tokenAnalista,
    cuerpo: { estado: 'Finalizada' },
  });
  assert.equal(status, 409);
});

test('PATCH de estado rechaza estados inválidos y cuerpos vacíos', async () => {
  const { solicitudId } = await crearSolicitudPendiente();
  const invalido = await pedir('PATCH', `/solicitudes/${solicitudId}/estado`, {
    token: tokenAnalista,
    cuerpo: { estado: 'Cerrada' },
  });
  assert.equal(invalido.status, 400);
  const vacio = await pedir('PATCH', `/solicitudes/${solicitudId}/estado`, {
    token: tokenAnalista,
    cuerpo: {},
  });
  assert.equal(vacio.status, 400);
});

/* ------------------------------- Evaluaciones ----------------------------- */

test('no se evalúa una solicitud Pendiente (409)', async () => {
  const { solicitudId } = await crearSolicitudPendiente();
  const { status } = await pedir('POST', '/evaluaciones', {
    token: tokenEvaluador,
    cuerpo: { solicitudId, ...evaluacionValida },
  });
  assert.equal(status, 409);
});

test('flujo completo: En proceso → evaluación → Finalizada', async () => {
  const { solicitudId } = await crearSolicitudPendiente();

  const enProceso = await pedir('PATCH', `/solicitudes/${solicitudId}/estado`, {
    token: tokenEvaluador,
    cuerpo: { estado: 'En proceso', profesionalResponsable: 'Ignacia Valdés Ortiz' },
  });
  assert.equal(enProceso.status, 200);

  const creada = await pedir('POST', '/evaluaciones', {
    token: tokenEvaluador,
    cuerpo: { solicitudId, ...evaluacionValida },
  });
  assert.equal(creada.status, 201);
  assert.equal(creada.datos.evaluacion.diasRespuesta, 5);

  const solicitud = await pedir('GET', `/solicitudes/${solicitudId}`, { token: tokenAnalista });
  assert.equal(solicitud.datos.solicitud.estado, 'Finalizada');

  const duplicada = await pedir('POST', '/evaluaciones', {
    token: tokenEvaluador,
    cuerpo: { solicitudId, ...evaluacionValida },
  });
  assert.equal(duplicada.status, 409);
});

test('crear evaluación con datos inválidos responde 400', async () => {
  const { status, datos } = await pedir('POST', '/evaluaciones', {
    token: tokenEvaluador,
    cuerpo: { solicitudId: 1, resultado: 'Cualquiera', observaciones: 'corta' },
  });
  assert.equal(status, 400);
  assert.ok(datos.errores.resultado);
  assert.ok(datos.errores.observaciones);
});

test('analista no puede registrar evaluaciones (403)', async () => {
  const { status } = await pedir('POST', '/evaluaciones', {
    token: tokenAnalista,
    cuerpo: { solicitudId: 1, ...evaluacionValida },
  });
  assert.equal(status, 403);
});

test('PUT de evaluación con resultado inválido responde 400 (antes 500 con stack)', async () => {
  const { status, datos } = await pedir('PUT', '/evaluaciones/1', {
    token: tokenEvaluador,
    cuerpo: { resultado: 'Cualquiera' },
  });
  assert.equal(status, 400);
  assert.equal(datos.detalle, undefined);
});

test('PUT de evaluación válido actualiza solo los campos enviados', async () => {
  const antes = await pedir('GET', '/evaluaciones/solicitud/2', { token: tokenEvaluador });
  const { status, datos } = await pedir('PUT', `/evaluaciones/${antes.datos.evaluacion.id}`, {
    token: tokenEvaluador,
    cuerpo: { resultado: 'No recomendado' },
  });
  assert.equal(status, 200);
  assert.equal(datos.evaluacion.resultado, 'No recomendado');
  assert.equal(datos.evaluacion.observaciones, antes.datos.evaluacion.observaciones);
});

/* ---------------------------- Planner (etapas) ---------------------------- */

test('la semilla incluye las solicitudes demo del Planner con su etapa y agenda', async () => {
  const { datos } = await pedir('GET', '/solicitudes/104', { token: tokenEvaluador });
  assert.equal(datos.solicitud.etapa, 'agendada');
  assert.equal(datos.solicitud.estado, 'En proceso');
  assert.equal(datos.solicitud.modalidadEntrevista, 'Teams');
});

test('una solicitud nueva parte en la etapa "recibida"', async () => {
  const { solicitudId } = await crearSolicitudPendiente();
  const { datos } = await pedir('GET', `/solicitudes/${solicitudId}`, { token: tokenAnalista });
  assert.equal(datos.solicitud.etapa, 'recibida');
});

test('Planner: agendar → realizada → volver a recibida sincroniza estado y agenda', async () => {
  const { solicitudId } = await crearSolicitudPendiente();
  const ruta = `/solicitudes/${solicitudId}/etapa`;

  const sinAgenda = await pedir('PATCH', ruta, { token: tokenEvaluador, cuerpo: { etapa: 'agendada' } });
  assert.equal(sinAgenda.status, 400);
  assert.ok(sinAgenda.datos.errores.fechaEntrevista);

  const agendada = await pedir('PATCH', ruta, {
    token: tokenEvaluador,
    cuerpo: {
      etapa: 'agendada',
      fechaEntrevista: '2026-01-08',
      horaEntrevista: '10:30',
      modalidadEntrevista: 'Teams',
    },
  });
  assert.equal(agendada.status, 200);
  assert.equal(agendada.datos.solicitud.estado, 'En proceso');
  assert.equal(agendada.datos.solicitud.horaEntrevista, '10:30');

  const realizada = await pedir('PATCH', ruta, { token: tokenEvaluador, cuerpo: { etapa: 'realizada' } });
  assert.equal(realizada.status, 200);
  assert.equal(realizada.datos.solicitud.etapa, 'realizada');
  assert.equal(realizada.datos.solicitud.fechaEntrevista, '2026-01-08');

  const recibida = await pedir('PATCH', ruta, { token: tokenEvaluador, cuerpo: { etapa: 'recibida' } });
  assert.equal(recibida.datos.solicitud.estado, 'Pendiente');
  assert.equal(recibida.datos.solicitud.fechaEntrevista, '');
});

test('Planner: valida la agenda, no asigna "informe" a mano y es solo para evaluadores', async () => {
  const { solicitudId } = await crearSolicitudPendiente();
  const ruta = `/solicitudes/${solicitudId}/etapa`;

  const horaFuera = await pedir('PATCH', ruta, {
    token: tokenEvaluador,
    cuerpo: { etapa: 'agendada', fechaEntrevista: '2026-01-08', horaEntrevista: '22:00', modalidadEntrevista: 'Teams' },
  });
  assert.equal(horaFuera.status, 400);
  assert.ok(horaFuera.datos.errores.horaEntrevista);

  const antesDeSolicitud = await pedir('PATCH', ruta, {
    token: tokenEvaluador,
    cuerpo: { etapa: 'agendada', fechaEntrevista: '2025-12-01', horaEntrevista: '10:00', modalidadEntrevista: 'Teams' },
  });
  assert.equal(antesDeSolicitud.status, 400);

  const informe = await pedir('PATCH', ruta, { token: tokenEvaluador, cuerpo: { etapa: 'informe' } });
  assert.equal(informe.status, 400);

  const realizadaSinAgenda = await pedir('PATCH', ruta, {
    token: tokenEvaluador,
    cuerpo: { etapa: 'realizada' },
  });
  assert.equal(realizadaSinAgenda.status, 409);

  const analista = await pedir('PATCH', ruta, { token: tokenAnalista, cuerpo: { etapa: 'recibida' } });
  assert.equal(analista.status, 403);
});

test('Planner: una solicitud finalizada no se reabre y la evaluación la deja en "informe"', async () => {
  const { solicitudId } = await crearSolicitudPendiente();
  await pedir('PATCH', `/solicitudes/${solicitudId}/estado`, {
    token: tokenEvaluador,
    cuerpo: { estado: 'En proceso' },
  });
  await pedir('POST', '/evaluaciones', { token: tokenEvaluador, cuerpo: { solicitudId, ...evaluacionValida } });

  const { datos } = await pedir('GET', `/solicitudes/${solicitudId}`, { token: tokenEvaluador });
  assert.equal(datos.solicitud.etapa, 'informe');

  const reabrir = await pedir('PATCH', `/solicitudes/${solicitudId}/etapa`, {
    token: tokenEvaluador,
    cuerpo: { etapa: 'realizada' },
  });
  assert.equal(reabrir.status, 409);
});

test('cambiar el estado ajusta la etapa del Planner para que no se contradigan', async () => {
  const { solicitudId } = await crearSolicitudPendiente();
  const { datos } = await pedir('PATCH', `/solicitudes/${solicitudId}/estado`, {
    token: tokenAnalista,
    cuerpo: { estado: 'En proceso' },
  });
  assert.equal(datos.solicitud.etapa, 'agendada');
});

test('la migración agrega las columnas del Planner a una base antigua sin perder datos', () => {
  const { DatabaseSync } = require('node:sqlite');
  const ruta = path.join(dirTemporal, 'antigua.sqlite');
  const antigua = new DatabaseSync(ruta);
  antigua.exec(`CREATE TABLE solicitudes (id INTEGER PRIMARY KEY, cargo TEXT);
                INSERT INTO solicitudes (id, cargo) VALUES (1, 'Operario');`);
  antigua.close();

  const { execFileSync } = require('node:child_process');
  execFileSync(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, 'bd', 'migrar.js')], {
    env: { ...process.env, AQUACHILE_BD: ruta },
  });

  const migrada = new DatabaseSync(ruta);
  const columnas = migrada.prepare('PRAGMA table_info(solicitudes)').all().map((c) => c.name);
  const fila = migrada.prepare('SELECT * FROM solicitudes WHERE id = 1').get();
  migrada.close();

  for (const columna of ['etapa', 'fecha_entrevista', 'hora_entrevista', 'modalidad_entrevista']) {
    assert.ok(columnas.includes(columna), `falta la columna ${columna}`);
  }
  assert.equal(fila.cargo, 'Operario');
});
