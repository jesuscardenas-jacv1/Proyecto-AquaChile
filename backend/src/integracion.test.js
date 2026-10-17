/**
 * Pruebas de la API que usa el frontend integrado (Hito 2): ofertas y postulaciones,
 * solicitudes con reclutador, psicóloga responsable, etapas del Planner y filtros.
 * Requiere la BD migrada y sembrada; al final restablece los datos de demostración.
 * Ejecutar con: npm run test:integracion
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('./servidor');
const { JWT_SECRETO } = require('./middlewares/auth');

describe('API integrada (Hito 2)', () => {
  let servidor;
  let base;
  const cabeceras = (rol) => ({
    Authorization: `Bearer ${jwt.sign({ id: 1, nombre: 'Prueba', rol }, JWT_SECRETO)}`,
    'Content-Type': 'application/json',
  });
  const pedir = async (ruta, { rol, metodo = 'GET', cuerpo } = {}) => {
    const respuesta = await fetch(`${base}${ruta}`, {
      method: metodo,
      headers: rol ? cabeceras(rol) : { 'Content-Type': 'application/json' },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    return { status: respuesta.status, datos: await respuesta.json().catch(() => ({})) };
  };

  before(() => {
    servidor = app.listen(0);
    base = `http://localhost:${servidor.address().port}/api`;
  });

  after(async () => {
    await pedir('/admin/reiniciar', { rol: 'admin', metodo: 'POST' });
    servidor.close();
  });

  it('publica las ofertas abiertas sin sesión', async () => {
    const { status, datos } = await pedir('/ofertas');
    assert.equal(status, 200);
    assert.equal(datos.ofertas.length, 8);
    assert.ok(Array.isArray(datos.ofertas[0].requisitos));
    assert.equal((await pedir('/ofertas/999')).status, 404);
  });

  it('registra una postulación pública y valida sus datos', async () => {
    const invalida = await pedir('/postulaciones', { metodo: 'POST', cuerpo: { ofertaId: 1, nombre: 'Al' } });
    assert.equal(invalida.status, 400);

    const valida = await pedir('/postulaciones', {
      metodo: 'POST',
      cuerpo: {
        ofertaId: 2,
        nombre: 'Postulante Integración',
        correo: `integracion.${Date.now()}@correo.cl`,
        telefono: '+56911112222',
        ciudad: 'Osorno',
        origen: 'Externo',
        consentimiento: true,
        cvNombre: 'cv.pdf',
      },
    });
    assert.equal(valida.status, 201);
    assert.deepEqual(Object.keys(valida.datos.postulacion), ['id']);
  });

  it('la bandeja de postulaciones es para analista y jefatura, no para el evaluador', async () => {
    assert.equal((await pedir('/postulaciones')).status, 401);
    assert.equal((await pedir('/postulaciones', { rol: 'evaluador' })).status, 403);
    const { status, datos } = await pedir('/postulaciones', { rol: 'jefatura' });
    assert.equal(status, 200);
    assert.ok(datos.postulaciones.length >= 8);
  });

  it('pasa una postulación a evaluación: crea la solicitud y la vincula', async () => {
    const nueva = await pedir('/solicitudes', {
      rol: 'analista',
      metodo: 'POST',
      cuerpo: {
        candidatoId: 201,
        cargo: 'Monitor Producción',
        familiaCargo: 'Técnico B C',
        fechaSolicitud: '2026-10-20',
        reclutador: 'Carolina Muñoz',
        referido: null,
      },
    });
    assert.equal(nueva.status, 201);
    assert.equal(nueva.datos.solicitud.reclutador, 'Carolina Muñoz');
    assert.equal(nueva.datos.solicitud.profesionalResponsable, '');
    assert.equal(nueva.datos.solicitud.etapa, 'recibida');
    assert.equal(nueva.datos.solicitud.referido, null);

    const id = nueva.datos.solicitud.id;
    const vinculada = await pedir('/postulaciones/1', {
      rol: 'analista',
      metodo: 'PATCH',
      cuerpo: { estado: 'En evaluación', solicitudId: id },
    });
    assert.equal(vinculada.status, 200);
    assert.deepEqual([vinculada.datos.postulacion.estado, vinculada.datos.postulacion.solicitudId], ['En evaluación', id]);

    assert.equal(
      (await pedir('/postulaciones/1', { rol: 'jefatura', metodo: 'PATCH', cuerpo: { estado: 'Descartada' } })).status,
      403,
    );
  });

  it('asigna y quita la psicóloga responsable', async () => {
    const asignada = await pedir('/solicitudes/101/estado', {
      rol: 'analista',
      metodo: 'PATCH',
      cuerpo: { profesionalResponsable: 'Tomás Riquelme Soto' },
    });
    assert.equal(asignada.datos.solicitud.profesionalResponsable, 'Tomás Riquelme Soto');
    assert.equal(asignada.datos.solicitud.estado, 'Pendiente');

    const sinAsignar = await pedir('/solicitudes/101/estado', {
      rol: 'analista',
      metodo: 'PATCH',
      cuerpo: { profesionalResponsable: '' },
    });
    assert.equal(sinAsignar.datos.solicitud.profesionalResponsable, '');
  });

  it('el evaluador mueve la etapa del Planner y el estado se sincroniza', async () => {
    const agendada = await pedir('/solicitudes/101/etapa', {
      rol: 'evaluador',
      metodo: 'PATCH',
      cuerpo: { etapa: 'agendada', fechaEntrevista: '2026-10-22', horaEntrevista: '10:30', modalidadEntrevista: 'Teams' },
    });
    assert.equal(agendada.status, 200);
    assert.deepEqual(
      [agendada.datos.solicitud.etapa, agendada.datos.solicitud.estado, agendada.datos.solicitud.modalidadEntrevista],
      ['agendada', 'En proceso', 'Teams'],
    );

    const devuelta = await pedir('/solicitudes/101/etapa', { rol: 'evaluador', metodo: 'PATCH', cuerpo: { etapa: 'recibida' } });
    assert.deepEqual([devuelta.datos.solicitud.estado, devuelta.datos.solicitud.fechaEntrevista], ['Pendiente', '']);

    assert.equal((await pedir('/solicitudes/101/etapa', { rol: 'analista', metodo: 'PATCH', cuerpo: { etapa: 'agendada' } })).status, 403);
    assert.equal((await pedir('/solicitudes/101/etapa', { rol: 'evaluador', metodo: 'PATCH', cuerpo: { etapa: 'otra' } })).status, 400);
  });

  it('filtra solicitudes por fecha y por psicóloga responsable (RF07)', async () => {
    const rango = await pedir('/solicitudes?desde=2026-10-01&hasta=2026-10-31', { rol: 'jefatura' });
    assert.ok(rango.datos.solicitudes.length > 0);
    assert.ok(rango.datos.solicitudes.every((s) => s.fechaSolicitud >= '2026-10-01' && s.fechaSolicitud <= '2026-10-31'));

    const responsable = await pedir('/solicitudes?responsable=Ignacia%20Vald%C3%A9s%20Ortiz', { rol: 'jefatura' });
    assert.ok(responsable.datos.solicitudes.every((s) => s.profesionalResponsable === 'Ignacia Valdés Ortiz'));

    assert.equal((await pedir('/solicitudes?desde=17-10-2026', { rol: 'jefatura' })).status, 400);
  });

  it('el evaluador solo recibe candidatos que pasaron a evaluación', async () => {
    const todos = await pedir('/candidatos', { rol: 'analista' });
    const delEvaluador = await pedir('/candidatos', { rol: 'evaluador' });
    assert.ok(delEvaluador.datos.candidatos.length < todos.datos.candidatos.length);
    assert.equal(delEvaluador.datos.candidatos.some((c) => c.id === 202), false);
    assert.equal((await pedir('/candidatos/202', { rol: 'evaluador' })).status, 404);
  });

  it('solo el administrador restablece los datos de demostración', async () => {
    assert.equal((await pedir('/admin/reiniciar', { rol: 'analista', metodo: 'POST' })).status, 403);
    const { status, datos } = await pedir('/admin/reiniciar', { rol: 'admin', metodo: 'POST' });
    assert.equal(status, 200);
    assert.equal(datos.totales.solicitudes, 108);
  });
});
