/**
 * Pruebas de Marea con un cliente de IA simulado: no llaman a la API real ni tienen costo.
 * Usan una BD y una carpeta de documentos temporales (no tocan datos.sqlite).
 * Ejecutar con: npm run test:agente
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'marea-'));
process.env.BD_RUTA = path.join(temporal, 'marea.sqlite');
process.env.ALMACENAMIENTO = 'local';
process.env.ALMACENAMIENTO_LOCAL_RUTA = path.join(temporal, 'documentos');
process.env.REUNIONES_GOOGLE = 'no';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { BLOQUES, horasLibres, horaDisponible, sumarDias } = require('./horarios');
const { buscarPorNombre, digitoVerificador, formatearRut, rutEnTexto, rutFicticio, rutValido } = require('./identidad');
const { FRASES, elegirVariante, frase } = require('./frases');

// Viernes 20-11-2026, 10:00 en Chile (UTC-3 en verano).
const VIERNES_10 = new Date('2026-11-20T13:00:00Z');

describe('horarios de Marea', () => {
  it('hoy solo ofrece bloques que empiezan al menos 30 min después', () => {
    assert.deepEqual(horasLibres({ ahora: VIERNES_10 }), {
      fecha: '2026-11-20',
      bloques: ['11:00', '12:00', '14:30', '15:30', '16:30'].map((hora, i) => ({ hora, primera: i === 0 })),
    });
    // 10:31 → las 11:00 quedan a menos de 30 min.
    const libres = horasLibres({ ahora: new Date('2026-11-20T13:31:00Z') });
    assert.equal(libres.bloques[0].hora, '12:00');
  });

  it('el fin de semana pasa al lunes', () => {
    const sabado = new Date('2026-11-21T13:00:00Z');
    const libres = horasLibres({ ahora: sabado });
    assert.equal(libres.fecha, '2026-11-23');
    assert.equal(libres.bloques[0].hora, '09:00');
  });

  it('un día lleno salta al siguiente día hábil', () => {
    const ocupadas = ['11:00', '12:00', '14:30', '15:30', '16:30'].map((hora) => ({ fecha: '2026-11-20', hora }));
    const libres = horasLibres({ ahora: VIERNES_10, ocupadas });
    assert.equal(libres.fecha, '2026-11-23');
  });

  it('una entrevista a una hora cualquiera bloquea los bloques que se cruzan', () => {
    const libres = horasLibres({ ahora: new Date('2026-11-23T10:00:00Z'), ocupadas: [{ fecha: '2026-11-23', hora: '09:30' }] });
    assert.deepEqual(libres.bloques.map((b) => b.hora).slice(0, 2), ['11:00', '12:00']);
  });

  it('sin horas en 15 días devuelve null y revisa una hora concreta', () => {
    const ocupadas = [];
    for (let d = 0; d < 21; d += 1) {
      for (const hora of BLOQUES) ocupadas.push({ fecha: sumarDias('2026-11-20', d), hora });
    }
    assert.equal(horasLibres({ ahora: VIERNES_10, ocupadas }), null);
    assert.equal(horaDisponible({ fecha: '2026-11-20', hora: '11:00', ahora: VIERNES_10 }), true);
    assert.equal(horaDisponible({ fecha: '2026-11-20', hora: '10:00', ahora: VIERNES_10 }), false);
    assert.equal(horaDisponible({ fecha: '2026-11-21', hora: '11:00', ahora: VIERNES_10 }), false);
  });
});

describe('identidad de Marea', () => {
  it('valida el dígito verificador con módulo 11, incluida la K', () => {
    assert.equal(rutValido('11.111.111-1'), true);
    assert.equal(rutValido('11.111.111-2'), false);
    assert.equal(digitoVerificador('10000013'), 'K');
    assert.equal(rutValido('10.000.013-k'), true);
    assert.equal(rutValido('no es rut'), false);
    assert.equal(formatearRut('11111111-1'), '11.111.111-1');
    assert.equal(rutEnTexto('su rut es 11.111.111-1, gracias'), '11.111.111-1');
  });

  it('los RUT ficticios de la semilla son válidos y estables', () => {
    for (const id of [1, 101, 208]) assert.equal(rutValido(rutFicticio(id)), true);
    assert.equal(rutFicticio(101), rutFicticio(101));
  });

  it('busca por nombre sin tildes y con todas las palabras', () => {
    const personas = [{ nombre: 'Valentina Ríos Ojeda' }, { nombre: 'Valentina Uribe Rodríguez' }];
    assert.deepEqual(buscarPorNombre(personas, 'valentina rios'), [personas[0]]);
    assert.equal(buscarPorNombre(personas, 'Valentina').length, 2);
    assert.deepEqual(buscarPorNombre(personas, 'Tomás'), []);
  });
});

describe('frases de Marea', () => {
  it('nunca repite la misma frase dos veces seguidas', () => {
    let anterior = '';
    for (let i = 0; i < 30; i += 1) {
      const actual = frase('prueba', 'entrarAgenda');
      assert.notEqual(actual, anterior);
      anterior = actual;
    }
    assert.notEqual(elegirVariante('noEntiende', FRASES.noEntiende[0], () => 0), FRASES.noEntiende[0]);
  });
});

describe('Marea en la API', () => {
  const { establecerClienteIa } = require('../ia/cliente');
  const db = require('../bd/conexion');
  let app;
  let servidor;
  let base;
  let intencion;
  let llamadasIa;

  const USUARIOS = {
    analista: { id: 1, nombre: 'Carolina Muñoz', rol: 'analista' },
    evaluador: { id: 2, nombre: 'Ignacia Valdés Ortiz', rol: 'evaluador' },
    admin: { id: 3, nombre: 'Andrés Valdivia', rol: 'admin' },
    jefatura: { id: 4, nombre: 'Patricia Saavedra', rol: 'jefatura' },
  };
  const conversar = async (rol, cuerpo) => {
    const res = await fetch(`${base}/agente/mensaje`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt.sign(USUARIOS[rol], require('../middlewares/auth').JWT_SECRETO)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    return { status: res.status, datos: await res.json() };
  };
  const solicitud = (id) => db.prepare('SELECT * FROM solicitudes WHERE id = ?').get(id);
  const clasificar = (datos) => {
    intencion = {
      intencion: 'agendar',
      faltante: '',
      respuesta: '',
      ...datos,
      parametros: { persona: '', rut: '', solicitudId: 0, cargo: '', fecha: '', hora: '', modalidad: '', tambienAgendar: false, ...datos.parametros },
    };
  };

  before(async () => {
    await require('../bd/semilla').sembrar({ silencioso: true });
    app = require('../servidor');
    servidor = app.listen(0);
    base = `http://localhost:${servidor.address().port}/api`;
  });
  after(() => {
    establecerClienteIa(null);
    servidor.close();
    db.close();
    fs.rmSync(temporal, { recursive: true, force: true });
  });
  beforeEach(() => {
    llamadasIa = 0;
    establecerClienteIa({
      beta: {
        messages: {
          create: async () => {
            llamadasIa += 1;
            return { model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(intencion) }] };
          },
        },
      },
    });
  });

  it('sin clave de IA Marea no responde', async () => {
    establecerClienteIa(null);
    const clave = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    assert.equal((await conversar('evaluador', { mensaje: 'hola' })).status, 503);
    if (clave) process.env.ANTHROPIC_API_KEY = clave;
  });

  it('la tarea agenteMarea aparece en la Configuración de IA del admin', () => {
    const { listarConfiguracion } = require('../ia/configuracion');
    const tarea = listarConfiguracion({ modeloServidor: 'x' }).tareas.find((t) => t.id === 'agenteMarea');
    assert.ok(tarea);
    assert.equal(tarea.vigente.esfuerzo, 'low');
  });

  it('evaluadora: agenda por nombre, pide el RUT, muestra horas y agenda solo al confirmar', async () => {
    clasificar({ intencion: 'agendar', parametros: { persona: 'Valentina Ríos' } });
    const pide = await conversar('evaluador', { mensaje: 'agenda a Valentina Ríos' });
    assert.equal(pide.status, 200);
    assert.match(pide.datos.texto, /RUT/);
    assert.equal(pide.datos.foco.pendiente, 'rut');
    assert.equal(llamadasIa, 1);

    const invalido = await conversar('evaluador', { mensaje: '11.111.111-2', foco: pide.datos.foco });
    assert.match(invalido.datos.texto, /no (es válido|cuadra)/);
    assert.equal(llamadasIa, 1, 'responder el RUT no llama a la IA');

    const horas = await conversar('evaluador', { mensaje: rutFicticio(101), foco: invalido.datos.foco });
    const [tarjeta] = horas.datos.tarjetas;
    assert.equal(tarjeta.tipo, 'horas');
    assert.equal(tarjeta.solicitudId, 101);
    assert.equal(tarjeta.bloques[0].primera, true);
    assert.equal(horas.datos.foco.verificado, true);
    assert.equal(solicitud(101).etapa, 'recibida', 'mostrar horas no guarda nada');

    const propuesta = await conversar('evaluador', {
      accion: { tipo: 'elegir_hora', solicitudId: 101, fecha: tarjeta.fecha, hora: tarjeta.bloques[0].hora, modalidad: 'Presencial' },
    });
    const [confirmacion] = propuesta.datos.tarjetas;
    assert.equal(confirmacion.tipo, 'confirmacion');
    assert.equal(solicitud(101).etapa, 'recibida');

    const agendada = await conversar('evaluador', { accion: confirmacion.accion });
    assert.equal(agendada.status, 200);
    const fila = solicitud(101);
    assert.equal(fila.etapa, 'agendada');
    assert.equal(fila.estado, 'En proceso');
    assert.equal(fila.fecha_entrevista, tarjeta.fecha);
    assert.equal(fila.hora_entrevista, tarjeta.bloques[0].hora);
    assert.equal(fila.modalidad_entrevista, 'Presencial');

    // La misma hora ya no se ofrece a otra persona (solicitud 102).
    const otra = await conversar('evaluador', { accion: { ...confirmacion.accion, solicitudId: 102 } });
    assert.match(otra.datos.texto, /ocup|tomó/);
    assert.equal(solicitud(102).etapa, 'recibida');
  });

  it('jefatura solo obtiene resúmenes: intentar agendar responde amable y no hace nada', async () => {
    clasificar({ intencion: 'agendar', parametros: { persona: 'Tomás Barrientos' } });
    const pide = await conversar('jefatura', { mensaje: 'agenda a Tomás' });
    assert.equal(pide.status, 200);
    assert.deepEqual(pide.datos.tarjetas, []);
    assert.ok(pide.datos.opciones.length > 0);

    const forzado = await conversar('jefatura', {
      accion: { tipo: 'confirmar_agenda', solicitudId: 102, fecha: '2026-12-01', hora: '09:00', modalidad: 'Presencial' },
    });
    assert.deepEqual(forzado.datos.tarjetas, []);
    assert.equal(solicitud(102).etapa, 'recibida');

    const resumen = await conversar('jefatura', { accion: { tipo: 'resumen_solicitud', solicitudId: 104 } });
    assert.equal(resumen.datos.tarjetas[0].tipo, 'resumen');
    assert.ok(!resumen.datos.opciones.some((o) => ['agendar', 'analizar_candidato'].includes(o.accion.tipo)));
  });

  it('el analista no ve la agenda de la psicóloga', async () => {
    const respuesta = await conversar('analista', { accion: { tipo: 'agendar', solicitudId: 101 } });
    assert.match(respuesta.datos.texto, /agenda es de la psicóloga/);
    assert.ok(!respuesta.datos.tarjetas.some((t) => t.tipo === 'horas'));
  });

  it('analista: «Analizar y agendar» muestra el mayor ajuste con el % que calcula cumplimiento.js', async () => {
    const criterios = [
      { requisito: 'Técnico en acuicultura', tipo: 'obligatorio', nivel: 'cumple', evidencia: 'Técnico de nivel superior' },
      { requisito: '2 años de experiencia', tipo: 'obligatorio', nivel: 'parcial', evidencia: 'tiene 1 de los 2 años' },
      { requisito: 'Deseable licencia clase B', tipo: 'deseable', nivel: 'sin-evidencia', evidencia: '' },
    ];
    // El % guardado (99) no se usa: se recalcula con pesos fijos → (2·1 + 2·0,5 + 1·0) / 5 = 60 %.
    db.prepare("INSERT INTO analisis_cv (postulacion_id, resultado) VALUES (1, ?)").run(
      JSON.stringify({ resumen: 'x', criterios, preguntasSugeridas: [], alertas: [], cumplimiento: { porcentaje: 99 } }),
    );
    const respuesta = await conversar('analista', { accion: { tipo: 'analizar_candidato', postulacionId: 1, tambienAgendar: true } });
    const tarjeta = respuesta.datos.tarjetas.find((t) => t.tipo === 'analisis');
    assert.equal(tarjeta.mayorAjuste.porcentaje, 60);
    assert.equal(tarjeta.nota, 'La decisión es tuya.');
    assert.deepEqual(tarjeta.fortalezas, ['Técnico en acuicultura']);
    assert.match(respuesta.datos.texto, /agenda es de la psicóloga/);
    assert.equal(llamadasIa, 0, 'los botones no llaman a la IA');
    assert.doesNotMatch(JSON.stringify(respuesta.datos), /contratar|descartar/i);
  });

  it('nunca muestra notas clínicas ni la pauta', async () => {
    const evaluacion = db.prepare('SELECT * FROM evaluaciones WHERE observaciones <> \'\' LIMIT 1').get();
    const respuesta = await conversar('admin', { accion: { tipo: 'resumen_solicitud', solicitudId: evaluacion.solicitud_id } });
    assert.equal(respuesta.status, 200);
    assert.ok(!JSON.stringify(respuesta.datos).includes(evaluacion.observaciones));
  });

  it('GET /avisos lista los avisos del usuario con sus acciones', async () => {
    db.prepare("INSERT INTO notificaciones (usuario_id, tipo, mensaje, enlace) VALUES (1, 'postulacion', 'Nueva postulación', '/postulaciones?postulacion=1')").run();
    const res = await fetch(`${base}/agente/avisos`, {
      headers: { Authorization: `Bearer ${jwt.sign(USUARIOS.analista, require('../middlewares/auth').JWT_SECRETO)}` },
    });
    const datos = await res.json();
    assert.equal(datos.noLeidas, 1);
    assert.equal(datos.avisos[0].postulacionId, 1);
    assert.deepEqual(datos.avisos[0].acciones.map((a) => a.etiqueta), ['Analizar y agendar']);
  });

  it('si no entiende, ofrece caminos según el rol', async () => {
    clasificar({ intencion: 'fuera_de_alcance', respuesta: '' });
    const respuesta = await conversar('analista', { mensaje: '¿qué tiempo hace?' });
    assert.match(respuesta.datos.texto, /no lo capté|No te entendí/);
    assert.ok(respuesta.datos.opciones.every((o) => o.accion.tipo !== 'agendar'));
  });
});
