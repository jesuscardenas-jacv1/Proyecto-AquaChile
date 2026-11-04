/**
 * Pruebas del canal en tiempo real (Server-Sent Events).
 * Unitarias: quién recibe cada evento. Integración: un analista recibe el aviso
 * en su conexión abierta cuando otro registra un candidato.
 * Requiere la BD migrada y sembrada: npm run db:migrar && npm run db:semilla
 * Ejecutar con: node --test src/tiempoReal.test.js
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('./servidor');
const { conectar, emitir } = require('./tiempoReal');
const { JWT_SECRETO } = require('./middlewares/auth');

/** Respuesta falsa que registra lo escrito, para probar la entrega sin red. */
const respuestaFalsa = () => {
  const escrito = [];
  return {
    escrito,
    writeHead() {},
    flushHeaders() {},
    write(texto) {
      escrito.push(texto);
    },
  };
};

describe('tiempo real: a quién llega cada evento', () => {
  it('un evento dirigido solo llega al usuario indicado', () => {
    const resA = respuestaFalsa();
    const resB = respuestaFalsa();
    const cancelarA = conectar(1001, resA);
    const cancelarB = conectar(1002, resB);

    emitir('notificacion', { mensaje: 'solo para A' }, [1001]);

    assert.ok(resA.escrito.some((linea) => linea.includes('solo para A')));
    assert.ok(!resB.escrito.some((linea) => linea.includes('solo para A')));
    cancelarA();
    cancelarB();
  });

  it('un evento sin destinatarios llega a todas las conexiones abiertas', () => {
    const resA = respuestaFalsa();
    const resB = respuestaFalsa();
    const cancelarA = conectar(2001, resA);
    const cancelarB = conectar(2002, resB);

    emitir('datos', { ruta: '/api/candidatos' });

    assert.ok(resA.escrito.some((linea) => linea.includes('/api/candidatos')));
    assert.ok(resB.escrito.some((linea) => linea.includes('/api/candidatos')));
    cancelarA();
    cancelarB();
  });

  it('una conexión cancelada ya no recibe eventos', () => {
    const res = respuestaFalsa();
    const cancelar = conectar(3001, res);
    cancelar();
    const antes = res.escrito.length;

    emitir('datos', { ruta: '/api/solicitudes' });

    assert.equal(res.escrito.length, antes);
  });
});

describe('tiempo real: aviso de candidato nuevo', () => {
  let servidor;
  let base;
  let tokenAnalista;
  let idAnalista;

  const tokenAdmin = jwt.sign({ id: 9999, nombre: 'Administrador de prueba', rol: 'admin' }, JWT_SECRETO);

  /** Lee eventos SSE hasta encontrar uno que cumpla la condición, o se rinde a los 5 s. */
  async function esperarEvento(respuesta, evento, condicion) {
    const lector = respuesta.body.getReader();
    const decodificador = new TextDecoder();
    let acumulado = '';
    const limite = Date.now() + 5000;
    while (Date.now() < limite) {
      const { value, done } = await lector.read();
      if (done) break;
      acumulado += decodificador.decode(value, { stream: true });
      const bloques = acumulado.split('\n\n');
      acumulado = bloques.pop();
      for (const bloque of bloques) {
        const tipo = bloque.match(/^event: (.+)$/m)?.[1];
        const datos = bloque.match(/^data: (.+)$/m)?.[1];
        if (tipo === evento && datos && condicion(JSON.parse(datos))) {
          await lector.cancel();
          return JSON.parse(datos);
        }
      }
    }
    await lector.cancel();
    return null;
  }

  before(async () => {
    servidor = app.listen(0);
    base = `http://localhost:${servidor.address().port}/api`;
    const login = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: 'analista@aquachile.cl', contrasena: 'AquaChile2026!' }),
    });
    const datos = await login.json();
    tokenAnalista = datos.token;
    idAnalista = datos.usuario.id;
  });

  after(() => servidor.close());

  it('el analista recibe el aviso en su conexión cuando otro registra un candidato', async () => {
    const conexion = await fetch(`${base}/eventos`, {
      headers: { Authorization: `Bearer ${tokenAnalista}` },
    });
    assert.equal(conexion.status, 200);
    assert.match(conexion.headers.get('content-type'), /text\/event-stream/);

    const nombre = `Candidata de prueba ${Date.now()}`;
    const esperado = esperarEvento(conexion, 'notificacion', (aviso) => aviso.mensaje.includes(nombre));
    await fetch(`${base}/candidatos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenAdmin}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre,
        correo: `prueba.${Date.now()}@ejemplo.cl`,
        telefono: '+56 9 0000 0000',
        cargo: 'Operario',
        familiaCargo: 'Operaciones',
        origen: 'Externo',
      }),
    });

    const aviso = await esperado;
    assert.ok(aviso, 'el analista debe recibir el aviso en tiempo real');
    assert.equal(aviso.tipo, 'candidato');
    assert.equal(aviso.leida, false);
    assert.ok(idAnalista);
  });
});
