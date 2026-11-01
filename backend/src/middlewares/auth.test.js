/**
 * Pruebas de la clave de firma de sesiones (JWT_SECRETO).
 * Ejecutar con: npm run test:auth
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { resolverSecreto } = require('./auth');

const sinAviso = () => {};

describe('clave de firma JWT', () => {
  it('usa JWT_SECRETO cuando está definido', () => {
    const secreto = 'x'.repeat(40);
    assert.equal(resolverSecreto({ JWT_SECRETO: `  ${secreto}  ` }, sinAviso), secreto);
  });

  it('rechaza una clave de menos de 32 caracteres', () => {
    assert.throws(() => resolverSecreto({ JWT_SECRETO: 'corta' }, sinAviso), /al menos 32 caracteres/);
  });

  it('en producción no arranca sin JWT_SECRETO', () => {
    assert.throws(() => resolverSecreto({ NODE_ENV: 'production' }, sinAviso), /Falta JWT_SECRETO/);
  });

  it('en desarrollo genera una clave aleatoria distinta en cada ejecución y lo avisa', () => {
    const avisos = [];
    const a = resolverSecreto({}, (mensaje) => avisos.push(mensaje));
    const b = resolverSecreto({}, sinAviso);
    assert.ok(a.length >= 32);
    assert.notEqual(a, b);
    assert.match(avisos[0], /JWT_SECRETO no definido/);
  });

  it('el código ya no contiene la clave fija anterior', () => {
    const fuente = require('fs').readFileSync(require.resolve('./auth'), 'utf8');
    assert.ok(!fuente.includes('aquachile-secreto'));
  });
});
