/**
 * Pruebas de la API que usa el frontend integrado (Hito 2): ofertas y postulaciones,
 * solicitudes con reclutador, psicóloga responsable, etapas del Planner y filtros.
 * Requiere la BD migrada y sembrada; al final restablece los datos de demostración.
 * Ejecutar con: npm run test:integracion
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const app = require('./servidor');
const { JWT_SECRETO } = require('./middlewares/auth');
const { establecerAlmacenamiento } = require('./almacenamiento');
const { AlmacenamientoLocal } = require('./almacenamiento/local');

describe('API integrada (Hito 2)', () => {
  let servidor;
  let base;
  let raizDocumentos;
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

  before(async () => {
    // Las carpetas de documentos se crean en una carpeta temporal, no en backend/documentos.
    raizDocumentos = await fs.mkdtemp(path.join(os.tmpdir(), 'aquachile-integracion-'));
    establecerAlmacenamiento(new AlmacenamientoLocal({ raiz: raizDocumentos }));
    servidor = app.listen(0);
    base = `http://localhost:${servidor.address().port}/api`;
  });

  after(async () => {
    await pedir('/admin/reiniciar', { rol: 'admin', metodo: 'POST' });
    servidor.close();
    establecerAlmacenamiento(null);
    await fs.rm(raizDocumentos, { recursive: true, force: true });
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

    // Cada solicitud nace con su carpeta de documentos: "S0000 - Nombre del postulante".
    const id = nueva.datos.solicitud.id;
    const clave = `S${String(id).padStart(4, '0')}`;
    assert.equal(nueva.datos.avisoCarpeta, null);
    assert.match(nueva.datos.carpeta.nombre, new RegExp(`^${clave} - \\S`));
    assert.ok((await fs.readdir(raizDocumentos)).includes(nueva.datos.carpeta.nombre));
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

  it('descarga el CV de una postulación solo con sesión de analista o jefatura', async () => {
    const nueva = await pedir('/postulaciones', {
      metodo: 'POST',
      cuerpo: {
        ofertaId: 1,
        nombre: 'Valentina Rojas Pérez',
        correo: 'valentina.cv@correo.cl',
        telefono: '+56911112222',
        ciudad: 'Puerto Montt',
        origen: 'Externo',
        consentimiento: true,
        cvNombre: 'cv-valentina.pdf',
      },
    });
    const id = nueva.datos.postulacion.id;
    assert.equal((await pedir(`/postulaciones/${id}/cv`, { rol: 'analista' })).status, 404);

    const subida = await fetch(`${base}/postulaciones/${id}/cv?nombre=cv-valentina.pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf', 'X-Candidato': encodeURIComponent('Valentina Rojas Pérez') },
      body: Buffer.from('%PDF-1.4 CV de prueba'),
    });
    assert.equal(subida.status, 201);

    assert.equal((await pedir(`/postulaciones/${id}/cv`)).status, 401);
    assert.equal((await pedir(`/postulaciones/${id}/cv`, { rol: 'evaluador' })).status, 403);
    const descarga = await fetch(`${base}/postulaciones/${id}/cv`, { headers: cabeceras('jefatura') });
    assert.equal(descarga.status, 200);
    assert.match(descarga.headers.get('content-disposition'), /cv-valentina\.pdf/);
    assert.equal(Buffer.from(await descarga.arrayBuffer()).toString(), '%PDF-1.4 CV de prueba');
    assert.equal((await pedir('/postulaciones/9999/cv', { rol: 'analista' })).status, 404);
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
  it('analista y psicóloga corrigen los datos de una solicitud; la jefatura no', async () => {
    const editar = (rol, cuerpo) => pedir('/solicitudes/2', { rol, metodo: 'PATCH', cuerpo });

    const porAnalista = await editar('analista', { cargo: 'Analista de Sistemas', familiaCargo: 'Profesional B C', ceco: 'b123456789' });
    assert.equal(porAnalista.status, 200);
    assert.equal(porAnalista.datos.solicitud.cargo, 'Analista de Sistemas');
    assert.equal(porAnalista.datos.solicitud.ceco, 'B123456789');

    const porPsicologa = await editar('evaluador', { observaciones: 'Indagar liderazgo.', requiereReferencias: true });
    assert.equal(porPsicologa.status, 200);
    assert.equal(porPsicologa.datos.solicitud.observaciones, 'Indagar liderazgo.');
    assert.equal(porPsicologa.datos.solicitud.requiereReferencias, true);
    // Lo no enviado se conserva.
    assert.equal(porPsicologa.datos.solicitud.cargo, 'Analista de Sistemas');

    assert.equal((await editar('jefatura', { cargo: 'X' })).status, 403);
    assert.equal((await editar('analista', { cargo: '  ' })).status, 400);
    assert.equal((await editar('analista', { ceco: '123' })).status, 400);
    assert.equal((await editar('analista', { fechaSolicitud: '2999-01-01' })).status, 400);
    assert.equal((await editar('analista', {})).status, 400);
    assert.equal((await pedir('/solicitudes/99999', { rol: 'analista', metodo: 'PATCH', cuerpo: { cargo: 'X' } })).status, 404);
  });

  it('la evaluación guarda competencias, visibles para el analista sin las notas clínicas', async () => {
    const nueva = await pedir('/solicitudes', {
      rol: 'analista',
      metodo: 'POST',
      cuerpo: { candidatoId: 1, cargo: 'Monitor Producción', familiaCargo: 'Técnico B C', reclutador: 'Carolina Muñoz' },
    });
    const solicitudId = nueva.datos.solicitud.id;
    const competencias = [
      { competencia: 'Trabajo en equipo', nivel: 'Esperado', fortalezas: 'Coordina con su turno.', oportunidades: '' },
    ];

    const invalida = await pedir('/evaluaciones', {
      rol: 'evaluador',
      metodo: 'POST',
      cuerpo: { solicitudId, resultado: 'Recomendado', observaciones: 'Nota clínica.', competencias: [{ competencia: 'Trabajo en equipo', nivel: 'Excelente', fortalezas: 'x' }] },
    });
    assert.equal(invalida.status, 400);

    const creada = await pedir('/evaluaciones', {
      rol: 'evaluador',
      metodo: 'POST',
      cuerpo: { solicitudId, resultado: 'Recomendado', observaciones: 'Nota clínica reservada.', competencias },
    });
    assert.equal(creada.status, 201);
    assert.deepEqual(creada.datos.evaluacion.competencias, competencias);

    const vistaAnalista = await pedir(`/evaluaciones/solicitud/${solicitudId}`, { rol: 'analista' });
    assert.deepEqual(vistaAnalista.datos.evaluacion.competencias, competencias);
    assert.equal(vistaAnalista.datos.evaluacion.observaciones, undefined);

    const actualizada = await pedir(`/evaluaciones/${creada.datos.evaluacion.id}`, {
      rol: 'evaluador',
      metodo: 'PUT',
      cuerpo: { competencias: [] },
    });
    assert.deepEqual(actualizada.datos.evaluacion.competencias, []);
  });
  it('el administrador gestiona usuarios de prueba; nadie más puede', async () => {
    assert.equal((await pedir('/admin/usuarios', { rol: 'analista' })).status, 403);
    assert.equal((await pedir('/admin/usuarios', { rol: 'jefatura' })).status, 403);

    const lista = await pedir('/admin/usuarios', { rol: 'admin' });
    assert.equal(lista.status, 200);
    assert.equal(lista.datos.usuarios.length, 4);
    assert.ok(lista.datos.usuarios.every((u) => !('contrasena_hash' in u) && !('contrasena' in u)));

    const datos = { nombre: 'Tomás Riquelme Soto', correo: 'Tomas.Riquelme@AquaChile.cl', rol: 'evaluador', contrasena: 'ClaveSegura2026' };
    assert.equal((await pedir('/admin/usuarios', { rol: 'admin', metodo: 'POST', cuerpo: { ...datos, contrasena: 'corta' } })).status, 400);
    const creado = await pedir('/admin/usuarios', { rol: 'admin', metodo: 'POST', cuerpo: datos });
    assert.equal(creado.status, 201);
    assert.equal(creado.datos.usuario.correo, 'tomas.riquelme@aquachile.cl');
    assert.equal((await pedir('/admin/usuarios', { rol: 'admin', metodo: 'POST', cuerpo: datos })).status, 409);

    // El usuario nuevo puede iniciar sesión con su contraseña.
    const login = await pedir('/auth/login', { metodo: 'POST', cuerpo: { correo: datos.correo, contrasena: datos.contrasena } });
    assert.equal(login.status, 200);
    assert.equal(login.datos.usuario.rol, 'evaluador');

    const id = creado.datos.usuario.id;
    const editado = await pedir(`/admin/usuarios/${id}`, {
      rol: 'admin',
      metodo: 'PUT',
      cuerpo: { ...creado.datos.usuario, cargo: 'Psicólogo Evaluador', contrasena: 'OtraClave2026' },
    });
    assert.equal(editado.datos.usuario.cargo, 'Psicólogo Evaluador');
    const loginNueva = await pedir('/auth/login', { metodo: 'POST', cuerpo: { correo: datos.correo, contrasena: 'OtraClave2026' } });
    assert.equal(loginNueva.status, 200);

    assert.equal((await pedir(`/admin/usuarios/${id}`, { rol: 'admin', metodo: 'DELETE' })).status, 200);
    assert.equal((await pedir(`/admin/usuarios/${id}`, { rol: 'admin', metodo: 'DELETE' })).status, 404);
  });

  it('no se puede dejar el sistema sin administrador ni eliminarse a sí mismo', async () => {
    const { datos } = await pedir('/admin/usuarios', { rol: 'admin' });
    const admin = datos.usuarios.find((u) => u.rol === 'admin');
    const comoAdmin = (ruta, opciones) =>
      fetch(`${base}${ruta}`, {
        method: opciones.metodo,
        headers: {
          Authorization: `Bearer ${jwt.sign({ id: admin.id, nombre: admin.nombre, rol: 'admin' }, JWT_SECRETO)}`,
          'Content-Type': 'application/json',
        },
        body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
      });

    assert.equal((await comoAdmin(`/admin/usuarios/${admin.id}`, { metodo: 'DELETE' })).status, 400);
    const degradarse = await comoAdmin(`/admin/usuarios/${admin.id}`, { metodo: 'PUT', cuerpo: { ...admin, rol: 'analista' } });
    assert.equal(degradarse.status, 400);
    // Con la sesión de otra persona tampoco se puede eliminar al único administrador.
    const otro = await fetch(`${base}/admin/usuarios/${admin.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${jwt.sign({ id: 9999, nombre: 'Otro', rol: 'admin' }, JWT_SECRETO)}` },
    });
    assert.equal(otro.status, 400);
  });
});
