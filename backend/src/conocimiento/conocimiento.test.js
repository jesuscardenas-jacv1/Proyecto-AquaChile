/**
 * Pruebas de la base de conocimiento: catálogos, privacidad del perfil, búsquedas, permisos e historial.
 * Usan una BD temporal y no llaman a ningún servicio de IA. Ejecutar con: npm run test:perfil
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'conocimiento-'));
process.env.BD_RUTA = path.join(temporal, 'conocimiento.sqlite');
process.env.REUNIONES_GOOGLE = 'no';
delete process.env.GEMINI_API_KEY;

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { ciudadEnTexto, normalizarCiudad } = require('./ciudades');
const { habilidadesEnTexto, normalizarHabilidad } = require('./habilidades');
const { interpretar } = require('../agente/interprete');

const HOY = '2026-11-23';

describe('catálogos', () => {
  it('normaliza ciudades escritas de distintas formas', () => {
    for (const forma of ['pto montt', 'PMontt', 'Puerto Montt, Chile', ' puerto  montt ']) {
      assert.deepEqual(normalizarCiudad(forma), { ciudad: 'Puerto Montt', region: 'Los Lagos' }, forma);
    }
    assert.equal(normalizarCiudad('natales').ciudad, 'Puerto Natales');
    assert.deepEqual(normalizarCiudad('villa inventada'), { ciudad: 'Villa Inventada', region: '' });
    assert.deepEqual(normalizarCiudad(''), { ciudad: '', region: '' });
  });

  it('reconoce la ciudad de una pregunta sin confundirla con un apellido', () => {
    assert.equal(ciudadEnTexto('¿Quiénes son de pto. montt?'), 'Puerto Montt');
    assert.equal(ciudadEnTexto('gente que vive en Castro'), 'Castro');
    assert.equal(ciudadEnTexto('agenda a Juan Castro'), '');
  });

  it('une sinónimos de habilidades y guarda las nuevas tal cual', () => {
    assert.equal(normalizarHabilidad('pbi').nombre, 'Power BI');
    assert.deepEqual(normalizarHabilidad('filmación con dron', 'tecnica'), { nombre: 'Filmación con dron', categoria: 'tecnica', enCatalogo: false });
    assert.deepEqual(habilidadesEnTexto('que sepan excel avanzado y powerbi'), ['Excel avanzado', 'Power BI']);
  });
});

describe('intérprete local: preguntas sobre candidatos', () => {
  it('reconoce búsquedas, conteos, perfiles y actividad', () => {
    const casos = [
      ['¿Quiénes son de Puerto Montt y saben Power BI?', 'buscar_candidatos'],
      ['candidatos con licencia clase B', 'buscar_candidatos'],
      ['¿Cuántos postulantes hay por ciudad?', 'estadisticas'],
      ['Muéstrame el perfil de Ignacia', 'perfil_candidato'],
      ['¿Qué pasó esta semana?', 'actividad_reciente'],
      ['ranking de Técnico Eléctrico', 'ranking_cargo'],
      ['Busca una hora para Valentina', 'agendar'],
      ['Muéstrame mis solicitudes pendientes', 'listar_solicitudes'],
    ];
    for (const [mensaje, intencion] of casos) assert.equal(interpretar(mensaje, HOY).intencion, intencion, mensaje);
    const { parametros } = interpretar('¿Quiénes son de pto montt y saben powerbi?', HOY);
    assert.equal(parametros.ciudad, 'Puerto Montt');
    assert.deepEqual(parametros.habilidades, ['Power BI']);
    assert.equal(interpretar('actividad de los últimos 7 días', HOY).parametros.desde, '2026-11-16');
  });
});

describe('base de conocimiento', () => {
  const db = require('../bd/conexion');
  const { buscarCandidatos, contar, listarEventos, resumenConocimiento } = require('./consultas');
  const { guardarPerfil, normalizarPerfil, obtenerPerfil } = require('./perfiles');
  const { registrarEvento } = require('../bd/eventos');
  const { procesarMensaje } = require('../agente');

  const ANALISTA = { id: 1, nombre: 'Carolina Muñoz', rol: 'analista' };
  const PSICOLOGA = { id: 2, nombre: 'Ignacia Valdés Ortiz', rol: 'evaluador' };
  const JEFATURA = { id: 4, nombre: 'Patricia Saavedra', rol: 'jefatura' };
  const nombres = (resultado) => resultado.candidatos.map((c) => c.nombre);

  before(async () => {
    await require('../bd/semilla').sembrar({ silencioso: true });
  });
  after(() => {
    db.close();
    fs.rmSync(temporal, { recursive: true, force: true });
  });

  it('el perfil nunca guarda datos de contacto ni sensibles', () => {
    const perfil = normalizarPerfil({
      ciudad: 'pto montt',
      resumen: 'Ingeniera con 5 años de experiencia. Estado civil: casada. Contacto ana@correo.cl o +56 9 1234 5678.',
      habilidades: [
        { habilidad: 'powerbi', categoria: 'herramienta', evidencia: 'Tableros; RUT 12.345.678-5' },
        { habilidad: 'Power BI', categoria: 'herramienta', evidencia: 'repetida' },
        { habilidad: 'Nacionalidad chilena', categoria: 'blanda', evidencia: '' },
      ],
      aniosExperiencia: 999,
      campoInventado: 'x',
    });
    const texto = JSON.stringify(perfil);
    assert.doesNotMatch(texto, /casada|ana@|1234 5678|12\.345|nacionalidad|campoInventado/i);
    assert.match(perfil.resumen, /Ingeniera con 5 años de experiencia/);
    assert.equal(perfil.ciudad, 'Puerto Montt');
    assert.deepEqual(perfil.habilidades.map((h) => h.habilidad), ['Power BI']);
    assert.equal(perfil.aniosExperiencia, null);
  });

  it('busca por ciudad y habilidad combinadas, con su evidencia', () => {
    const resultado = buscarCandidatos(ANALISTA, { ciudad: 'pto montt', habilidades: ['pbi'] });
    assert.equal(resultado.total, 2);
    assert.deepEqual(nombres(resultado).sort(), ['Ignacia Pérez Lagos', 'Sofía Andrade Muñoz']);
    assert.ok(resultado.candidatos.every((c) => c.coincidencias[0].evidencia));
    assert.equal(buscarCandidatos(ANALISTA, { ciudad: 'Puerto Montt', habilidades: ['Power BI', 'SAP'] }).total, 1);
    // "Excel" también encuentra "Excel avanzado" e "Excel intermedio".
    assert.equal(buscarCandidatos(ANALISTA, { habilidades: ['Excel'] }).total, 2);
  });

  it('si nadie cumple todo, dice cuántos cumplen por separado', () => {
    const { total, parciales } = buscarCandidatos(ANALISTA, { ciudad: 'Castro', habilidades: ['Power BI'] });
    assert.equal(total, 0);
    assert.deepEqual(parciales, [{ etiqueta: 'de Castro', total: 1 }, { etiqueta: 'con Power BI', total: 2 }]);
  });

  it('busca texto libre en el extracto del CV y aguanta caracteres raros', () => {
    assert.ok(nombres(buscarCandidatos(ANALISTA, { textoLibre: 'centro de mar' })).includes('Josefa Barría Mansilla'));
    for (const raro of ['" OR 1=1 --', "'; DROP TABLE candidatos; --", '***', '%', 'NEAR(']) {
      assert.doesNotThrow(() => buscarCandidatos(ANALISTA, { textoLibre: raro, cargo: raro, ciudad: raro, habilidades: [raro] }));
    }
    assert.ok(db.prepare('SELECT COUNT(*) AS n FROM candidatos').get().n > 0);
  });

  it('los descartados no aparecen salvo que se pidan', () => {
    assert.ok(!nombres(buscarCandidatos(ANALISTA, { ciudad: 'Chonchi' })).includes('Felipe Oyarzo Cárcamo'));
    assert.ok(nombres(buscarCandidatos(ANALISTA, { ciudad: 'Chonchi', estado: 'Descartada' })).includes('Felipe Oyarzo Cárcamo'));
  });

  it('la psicóloga solo encuentra a los candidatos de sus solicitudes', () => {
    assert.equal(buscarCandidatos(PSICOLOGA, { habilidades: ['Power BI'] }).total, 0);
    const solicitud = (responsable) =>
      db
        .prepare("INSERT INTO solicitudes (candidato_id, cargo, familia_cargo, fecha_solicitud, profesional_responsable, etapa) VALUES (206, 'Analista', 'Profesional B C', '2026-11-20', ?, 'recibida')")
        .run(responsable).lastInsertRowid;
    const ajena = solicitud('Paula Henríquez Lagos');
    assert.equal(buscarCandidatos(PSICOLOGA, { habilidades: ['Power BI'] }).total, 0, 'la solicitud es de otra psicóloga');
    db.prepare('UPDATE solicitudes SET profesional_responsable = ? WHERE id = ?').run(PSICOLOGA.nombre, ajena);
    assert.deepEqual(nombres(buscarCandidatos(PSICOLOGA, { habilidades: ['Power BI'] })), ['Ignacia Pérez Lagos']);
    db.prepare('DELETE FROM solicitudes WHERE id = ?').run(ajena);
  });

  it('no repite a quien está registrado dos veces con el mismo correo', () => {
    const original = db.prepare('SELECT * FROM candidatos WHERE id = 208').get();
    const copia = Number(
      db.prepare("INSERT INTO candidatos (nombre, correo, telefono, cargo, familia_cargo) VALUES (?, ?, '', 'Analista', 'Profesional B C')").run(original.nombre, original.correo.toUpperCase()).lastInsertRowid,
    );
    guardarPerfil(copia, { ciudad: 'Puerto Montt', habilidades: [{ habilidad: 'Power BI', categoria: 'herramienta', evidencia: 'x' }] });
    assert.equal(buscarCandidatos(ANALISTA, { habilidades: ['Power BI'] }).total, 2);
    db.prepare('DELETE FROM candidatos WHERE id = ?').run(copia);
    assert.equal(obtenerPerfil(copia), null);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM busqueda_cv WHERE rowid = ?').get(copia).n, 0, 'tampoco queda en el índice');
  });

  it('cuenta por ciudad y por habilidad', () => {
    const porCiudad = contar(ANALISTA, { habilidades: ['Power BI'] }, { agruparPor: 'ciudad' });
    assert.deepEqual(porCiudad.grupos, [{ nombre: 'Puerto Montt', total: 2 }]);
    assert.ok(contar(ANALISTA, {}, { agruparPor: 'habilidad' }).grupos.some((g) => g.nombre === 'SQL' && g.total === 2));
  });

  it('el historial se filtra por rol y se borra con la entidad', () => {
    registrarEvento({ tipo: 'postulacion_recibida', entidad: 'postulacion', entidadId: 1, usuario: 'Portal', detalle: 'x' });
    registrarEvento({ tipo: 'solicitud_creada', entidad: 'solicitud', entidadId: 101, usuario: 'Carolina Muñoz', detalle: 'y' });
    assert.equal(listarEventos(ANALISTA).length, 2);
    assert.ok(listarEventos(PSICOLOGA).every((e) => e.tipo === 'solicitud_creada'));
    db.prepare('DELETE FROM postulaciones WHERE id = 1').run();
    assert.ok(listarEventos(ANALISTA).every((e) => e.tipo !== 'postulacion_recibida'));
    assert.doesNotThrow(() => registrarEvento({ tipo: 'inventado', entidad: 'solicitud', entidadId: 1 }));
  });

  it('Marea responde sin IA: tarjeta para la analista, solo un número para la jefatura', async () => {
    const mensaje = '¿Quiénes son de Puerto Montt y saben Power BI?';
    const analista = await procesarMensaje({ usuario: ANALISTA, mensaje });
    assert.equal(analista.tarjetas[0].tipo, 'candidatos');
    assert.equal(analista.tarjetas[0].candidatos.length, 2);
    assert.doesNotMatch(JSON.stringify(analista), /contratar|descartar/i);
    assert.doesNotMatch(JSON.stringify(analista), /@correo\.cl|\+569/);

    const jefatura = await procesarMensaje({ usuario: JEFATURA, mensaje });
    assert.match(jefatura.texto, /^2 personas/);
    assert.deepEqual(jefatura.tarjetas, []);
    assert.doesNotMatch(JSON.stringify(jefatura), /Ignacia|Sofía/);
    const forzado = await procesarMensaje({ usuario: JEFATURA, accion: { tipo: 'perfil_candidato', candidatoId: 206 } });
    assert.deepEqual(forzado.tarjetas, []);
  });

  it('no busca por datos sensibles', async () => {
    for (const mensaje of ['mujeres de Puerto Montt que sepan Power BI', 'candidatos solteros de Castro', 'personas de Osorno mayores de 40 años', 'postulantes venezolanos de Puerto Montt']) {
      const respuesta = await procesarMensaje({ usuario: ANALISTA, mensaje });
      assert.deepEqual(respuesta.tarjetas, [], mensaje);
      assert.match(respuesta.texto, /No busco por datos personales|Ese dato no se usa/, mensaje);
    }
    const experiencia = await procesarMensaje({ usuario: ANALISTA, mensaje: 'candidatos de Puerto Montt con SQL' });
    assert.equal(experiencia.tarjetas[0].tipo, 'candidatos');
  });

  it('resume el estado para el administrador, con las habilidades fuera de catálogo', () => {
    guardarPerfil(203, { habilidades: [{ habilidad: 'Filmación con dron', categoria: 'tecnica', evidencia: '' }] });
    const resumen = resumenConocimiento();
    assert.equal(resumen.perfiles, 8);
    assert.deepEqual(resumen.fueraDeCatalogo.map((h) => h.habilidad), ['Filmación con dron']);
    assert.equal(resumen.gemini.configurado, false);
  });
});
