/**
 * Pruebas de la cola del análisis automático del CV: turnos, límites, reintentos y pausas.
 * Usan una BD temporal y un analizador simulado: no llaman a la IA ni tienen costo.
 * Ejecutar con: npm run test:cola
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'aquachile-cola-'));
process.env.BD_RUTA = path.join(carpeta, 'cola.sqlite');

const { describe, it, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../bd/conexion');
const { establecerClienteIa } = require('./cliente');
const { encolar, establecerAnalizador, procesarSiguiente } = require('./colaAnalisis');

const ErrorConStatus = (status) => Object.assign(new Error(`Error ${status}`), { status });
const filaCola = (id) => db.prepare('SELECT * FROM cola_analisis_cv WHERE postulacion_id = ?').get(id);

describe('Cola del análisis automático del CV', () => {
  let ids;
  let analizadas;

  before(async () => {
    require('../bd/migrar').migrar();
    await require('../bd/semilla').sembrar({ silencioso: true });
    ids = db.prepare("SELECT id FROM postulaciones WHERE estado <> 'Descartada' ORDER BY id").all().map((p) => p.id);
    assert.ok(ids.length >= 3, 'la semilla trae postulaciones para probar');
    // La cola solo trabaja si hay IA: un cliente vacío basta, el analizador está simulado.
    establecerClienteIa({});
  });

  beforeEach(() => {
    db.exec('DELETE FROM cola_analisis_cv; DELETE FROM analisis_cv;');
    for (const variable of ['IA_ANALISIS_AUTOMATICO', 'IA_COLA_MAX_HORA', 'IA_COLA_MAX_DIA', 'IA_COLA_INTENTOS']) {
      delete process.env[variable];
    }
    analizadas = [];
    establecerAnalizador(async (id) => {
      analizadas.push(id);
    });
  });

  after(() => {
    establecerAnalizador(null);
    establecerClienteIa(null);
    db.close();
    fs.rmSync(carpeta, { recursive: true, force: true });
  });

  it('analiza de a una postulación, en orden de llegada', async () => {
    encolar(ids[1]);
    encolar(ids[0]);
    assert.equal(filaCola(ids[1]).estado, 'pendiente');

    assert.deepEqual(await procesarSiguiente(), { estado: 'listo', id: ids[1] });
    assert.deepEqual(analizadas, [ids[1]], 'una sola por llamada');
    assert.equal(filaCola(ids[1]).estado, 'listo');
    assert.equal(filaCola(ids[0]).estado, 'pendiente');

    assert.equal((await procesarSiguiente()).id, ids[0]);
    assert.equal((await procesarSiguiente()).estado, 'vacia');
  });

  it('respeta el máximo por hora: lo demás espera en la cola sin perderse', async () => {
    process.env.IA_COLA_MAX_HORA = '2';
    ids.slice(0, 3).forEach(encolar);

    await procesarSiguiente();
    await procesarSiguiente();
    const tercera = await procesarSiguiente();
    assert.equal(tercera.estado, 'limite');
    assert.ok(tercera.esperaMs > 0 && tercera.esperaMs <= 3601 * 1000, 'espera hasta que se libere cupo');
    assert.equal(analizadas.length, 2);
    assert.equal(filaCola(ids[2]).estado, 'pendiente');
  });

  it('respeta el máximo por día', async () => {
    process.env.IA_COLA_MAX_DIA = '1';
    ids.slice(0, 2).forEach(encolar);
    await procesarSiguiente();
    assert.equal((await procesarSiguiente()).estado, 'limite');
  });

  it('reintenta más tarde ante un fallo transitorio y se rinde al llegar al máximo de intentos', async () => {
    process.env.IA_COLA_INTENTOS = '2';
    establecerAnalizador(async () => {
      throw ErrorConStatus(502);
    });
    encolar(ids[0]);

    assert.equal((await procesarSiguiente()).estado, 'reintento');
    const fila = filaCola(ids[0]);
    assert.equal(fila.estado, 'pendiente');
    assert.equal(fila.intentos, 1);
    assert.ok(fila.proximo_intento > db.prepare("SELECT datetime('now') AS ahora").get().ahora, 'espera antes de reintentar');
    assert.equal((await procesarSiguiente()).estado, 'vacia', 'no reintenta de inmediato');

    db.prepare("UPDATE cola_analisis_cv SET proximo_intento = datetime('now')").run();
    assert.equal((await procesarSiguiente()).estado, 'error');
    assert.equal(filaCola(ids[0]).estado, 'error');
    assert.equal(filaCola(ids[0]).ultimo_error, 'Error 502');
  });

  it('omite la postulación sin CV y no reintenta un documento ilegible', async () => {
    establecerAnalizador(async (id) => {
      throw ErrorConStatus(id === ids[0] ? 404 : 422);
    });
    encolar(ids[0]);
    encolar(ids[1]);
    assert.equal((await procesarSiguiente()).estado, 'omitido');
    assert.equal((await procesarSiguiente()).estado, 'error');
    assert.equal(filaCola(ids[1]).intentos, 1);
  });

  it('pausa toda la cola si la IA avisa demasiadas solicitudes', async () => {
    establecerAnalizador(async () => {
      throw ErrorConStatus(429);
    });
    encolar(ids[0]);
    encolar(ids[1]);
    assert.equal((await procesarSiguiente()).estado, 'reintento');
    const siguiente = await procesarSiguiente();
    assert.equal(siguiente.estado, 'pausada');
    assert.ok(siguiente.esperaMs > 60 * 1000);
    assert.equal(filaCola(ids[1]).intentos, 0, 'la otra postulación no se intentó');
  });

  it('no analiza postulaciones descartadas ni las que ya tienen análisis', async () => {
    db.prepare("UPDATE postulaciones SET estado = 'Descartada' WHERE id = ?").run(ids[0]);
    db.prepare(`INSERT INTO analisis_cv (postulacion_id, resultado) VALUES (?, '{}')`).run(ids[1]);
    encolar(ids[0]);
    encolar(ids[1]);
    assert.equal((await procesarSiguiente()).estado, 'omitido');
    assert.equal((await procesarSiguiente()).estado, 'listo');
    assert.deepEqual(analizadas, [], 'no gastó llamadas a la IA');
    db.prepare("UPDATE postulaciones SET estado = 'Recibida' WHERE id = ?").run(ids[0]);
  });

  it('se puede apagar y no trabaja sin IA configurada', async () => {
    process.env.IA_ANALISIS_AUTOMATICO = 'no';
    assert.equal(encolar(ids[0]), false);
    assert.equal(filaCola(ids[0]), undefined);
    assert.equal((await procesarSiguiente()).estado, 'apagada');

    delete process.env.IA_ANALISIS_AUTOMATICO;
    encolar(ids[0]);
    establecerClienteIa(null);
    const anterior = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      assert.equal((await procesarSiguiente()).estado, 'sin-ia');
      assert.equal(filaCola(ids[0]).estado, 'pendiente', 'queda esperando a que haya clave');
    } finally {
      if (anterior) process.env.ANTHROPIC_API_KEY = anterior;
      establecerClienteIa({});
    }
  });
});
