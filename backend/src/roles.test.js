/**
 * Pruebas de los 4 roles del caso (admin, analista, evaluador, jefatura) en la API.
 * Requiere la BD migrada y sembrada: npm run db:migrar && npm run db:semilla
 * Ejecutar con: npm run test:roles
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('./servidor');
const { JWT_SECRETO, puedeVerNotasClinicas } = require('./middlewares/auth');

describe('roles del sistema', () => {
  let servidor;
  let base;

  const token = (rol) => jwt.sign({ id: 99, nombre: 'Prueba', rol }, JWT_SECRETO);
  const pedir = (rol, ruta, opciones = {}) =>
    fetch(`${base}${ruta}`, {
      ...opciones,
      headers: { Authorization: `Bearer ${token(rol)}`, 'Content-Type': 'application/json' },
    });

  before(() => {
    servidor = app.listen(0);
    base = `http://localhost:${servidor.address().port}/api`;
  });

  after(() => servidor.close());

  it('los usuarios de admin y jefatura pueden iniciar sesión', async () => {
    for (const [alias, rol] of [
      ['admin@aquachile.cl', 'admin'],
      ['jefatura@aquachile.cl', 'jefatura'],
    ]) {
      const respuesta = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo: alias, contrasena: 'AquaChile2026!' }),
      });
      const datos = await respuesta.json();
      assert.equal(respuesta.status, 200, alias);
      assert.equal(datos.usuario.rol, rol);
    }
  });

  it('solo evaluador y admin ven las notas clínicas', () => {
    assert.equal(puedeVerNotasClinicas('evaluador'), true);
    assert.equal(puedeVerNotasClinicas('admin'), true);
    assert.equal(puedeVerNotasClinicas('analista'), false);
    assert.equal(puedeVerNotasClinicas('jefatura'), false);
  });

  it('la jefatura consulta listados y detalle, sin observaciones clínicas', async () => {
    const listado = await pedir('jefatura', '/solicitudes');
    assert.equal(listado.status, 200);

    const evaluaciones = await (await pedir('jefatura', '/evaluaciones')).json();
    assert.ok(evaluaciones.evaluaciones.length > 0);
    assert.ok(evaluaciones.evaluaciones.every((e) => e.confidencial && e.observaciones === undefined));
  });

  it('la jefatura no puede crear, editar ni cambiar estados', async () => {
    const respuestas = await Promise.all([
      pedir('jefatura', '/candidatos', { method: 'POST', body: '{}' }),
      pedir('jefatura', '/solicitudes', { method: 'POST', body: '{}' }),
      pedir('jefatura', '/solicitudes/1/estado', {
        method: 'PATCH',
        body: JSON.stringify({ estado: 'En proceso' }),
      }),
      pedir('jefatura', '/evaluaciones', { method: 'POST', body: '{}' }),
    ]);
    assert.deepEqual(
      respuestas.map((r) => r.status),
      [403, 403, 403, 403],
    );
  });

  it('el admin pasa las restricciones de rol (llega a la validación de datos)', async () => {
    const respuesta = await pedir('admin', '/candidatos', { method: 'POST', body: '{}' });
    assert.equal(respuesta.status, 400);
  });
});
