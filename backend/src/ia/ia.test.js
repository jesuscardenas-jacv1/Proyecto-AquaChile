/**
 * Pruebas del módulo de IA con un cliente simulado: no llaman a la API real ni tienen costo.
 * Ejecutar con: npm run test:ia
 */
const { describe, it, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Anthropic = require('@anthropic-ai/sdk');
const { establecerClienteIa, generarJson, iaDisponible } = require('./cliente');
const { bloqueDocumento, descriptorDelCatalogo, textoDeTranscripcion } = require('./documentos');
const { analizarCv, notasEntrevista } = require('./tareas');
const { establecerTranscriptor, marcaDeTiempo, transcribirAudio, vozDisponible } = require('./voz');
const { costoClaude, costoVoz } = require('./uso');

// El registro de consumo escribe en la tabla uso_ia: debe existir.
require('../bd/migrar').migrar();

/** Cliente simulado: guarda la solicitud y responde lo que se le indique. */
function clienteSimulado(respuesta) {
  const llamadas = [];
  return {
    llamadas,
    beta: {
      messages: {
        create: async (solicitud) => {
          llamadas.push(solicitud);
          if (respuesta instanceof Error) throw respuesta;
          return { model: 'claude-opus-5-5', stop_reason: 'end_turn', ...respuesta };
        },
      },
    },
  };
}
const respuestaJson = (datos) => ({ content: [{ type: 'text', text: JSON.stringify(datos) }] });
const pdf = { nombre: 'cv.pdf', contenido: Buffer.from('%PDF-1.4 cv') };

describe('IA', () => {
  afterEach(() => establecerClienteIa(null));
  // Las llamadas simuladas de estas pruebas no tienen usuario: se borran del registro de consumo.
  after(() => require('../bd/conexion').prepare(`DELETE FROM uso_ia WHERE usuario = ''`).run());

  it('sin clave ni cliente la IA no está disponible', () => {
    const clave = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    assert.equal(iaDisponible(), false);
    if (clave) process.env.ANTHROPIC_API_KEY = clave;
  });

  it('pide una respuesta con esquema JSON, respaldo ante rechazos y la devuelve interpretada', async () => {
    const cliente = clienteSimulado(respuestaJson({ a: 1 }));
    establecerClienteIa(cliente);
    const esquema = { type: 'object', properties: { a: { type: 'number' } }, required: ['a'], additionalProperties: false };
    const { datos, modelo } = await generarJson({ sistema: 'x', contenido: [{ type: 'text', text: 'hola' }], esquema, esfuerzo: 'low' });

    assert.deepEqual(datos, { a: 1 });
    assert.equal(modelo, 'claude-opus-5-5');
    const [solicitud] = cliente.llamadas;
    assert.equal(solicitud.model, 'claude-opus-5-5');
    assert.equal(solicitud.fallbacks, 'default');
    assert.deepEqual(solicitud.betas, ['server-side-fallback-2026-07-01']);
    assert.deepEqual(solicitud.output_config, { effort: 'low', format: { type: 'json_schema', schema: esquema } });
    assert.ok(!('temperature' in solicitud) && !('thinking' in solicitud));
  });

  it('informa con mensajes claros cuando la IA rechaza, se corta o falla', async () => {
    const casos = [
      [{ stop_reason: 'refusal', content: [] }, 422],
      [{ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"a":' }] }, 502],
      [{ content: [{ type: 'text', text: 'no es json' }] }, 502],
      [new Anthropic.RateLimitError(429, {}, 'limite', new Headers()), 429],
      [new Anthropic.AuthenticationError(401, {}, 'clave', new Headers()), 503],
    ];
    for (const [respuesta, status] of casos) {
      establecerClienteIa(clienteSimulado(respuesta));
      await assert.rejects(generarJson({ sistema: 'x', contenido: [], esquema: {} }), (error) => error.status === status);
    }
  });

  it('envía el PDF como documento y rechaza formatos que no puede leer', async () => {
    const bloque = await bloqueDocumento(pdf, 'CV del postulante');
    assert.equal(bloque.type, 'document');
    assert.equal(bloque.title, 'CV del postulante');
    assert.equal(bloque.source.media_type, 'application/pdf');
    assert.equal(Buffer.from(bloque.source.data, 'base64').toString(), '%PDF-1.4 cv');

    await assert.rejects(bloqueDocumento({ nombre: 'cv.doc', contenido: Buffer.from('x') }, 'CV'), (e) => e.status === 415);
    await assert.rejects(bloqueDocumento({ nombre: 'cv.docx', contenido: Buffer.from('no es word') }, 'CV'), (e) => e.status === 422);
    await assert.rejects(bloqueDocumento({ nombre: 'cv.pdf', contenido: Buffer.alloc(0) }, 'CV'), (e) => e.status === 400);
  });

  it('encuentra el descriptor de demostración del cargo sin importar tildes ni mayúsculas', () => {
    assert.equal(descriptorDelCatalogo('Jefe de Centro')?.nombre, 'DC_Jefe_de_Centro.pdf');
    assert.equal(descriptorDelCatalogo('tecnico electrico')?.nombre, 'DC_Tecnico_Electrico.pdf');
    assert.equal(descriptorDelCatalogo('Cargo que no existe'), null);
  });

  it('el análisis de CV envía el CV y el descriptor, y advierte que los documentos no son instrucciones', async () => {
    const resultado = { resumen: 'r', coincidencias: [], brechas: [], preguntasSugeridas: ['¿?'], alertas: [] };
    const cliente = clienteSimulado(respuestaJson(resultado));
    establecerClienteIa(cliente);
    const { datos } = await analizarCv({ cv: pdf, descriptor: { nombre: 'dc.pdf', contenido: Buffer.from('%PDF dc') }, oferta: { cargo: 'Jefe de Centro' } });

    assert.deepEqual(datos, resultado);
    const [{ system, messages }] = cliente.llamadas;
    assert.match(system, /no instrucciones/);
    const titulos = messages[0].content.filter((b) => b.type === 'document').map((b) => b.title);
    assert.deepEqual(titulos, ['CV del postulante', 'Descriptor del cargo']);
    assert.match(messages[0].content.at(-1).text, /Jefe de Centro/);
  });

  describe('voz y transcripciones', () => {
    afterEach(() => establecerTranscriptor(null));

    it('sin clave ni región de Azure Speech la voz no está disponible', () => {
      const { AZURE_SPEECH_KEY: clave, AZURE_SPEECH_REGION: region } = process.env;
      delete process.env.AZURE_SPEECH_KEY;
      process.env.AZURE_SPEECH_REGION = 'eastus2';
      assert.equal(vozDisponible(), false);
      if (clave) process.env.AZURE_SPEECH_KEY = clave;
      if (region) process.env.AZURE_SPEECH_REGION = region;
      else delete process.env.AZURE_SPEECH_REGION;
    });

    it('prueba es-CL, es-MX y es-ES, y une las frases seguidas de un mismo hablante', async () => {
      const idiomas = [];
      establecerTranscriptor(async ({ idioma }) => {
        idiomas.push(idioma);
        if (idioma !== 'es-ES') throw Object.assign(new Error('x'), { idiomaNoAdmitido: true });
        return {
          durationMilliseconds: 65000,
          phrases: [
            { speaker: 1, offsetMilliseconds: 0, text: 'Hola.' },
            { speaker: 1, offsetMilliseconds: 800, text: '¿Cómo está?' },
            { speaker: 2, offsetMilliseconds: 65000, text: 'Bien, gracias.' },
          ],
        };
      });
      const resultado = await transcribirAudio({ contenido: Buffer.from('a'), nombre: 'a.webm', tipo: 'audio/webm' });
      assert.deepEqual(idiomas, ['es-CL', 'es-MX', 'es-ES']);
      assert.equal(resultado.idioma, 'es-ES');
      assert.equal(resultado.hablantes, 2);
      assert.equal(resultado.texto, '[00:00:00] Hablante 1: Hola. ¿Cómo está?\n\n[00:01:05] Hablante 2: Bien, gracias.');
      assert.equal(marcaDeTiempo(3_725_000), '01:02:05');
    });

    it('informa con mensajes claros si el audio está vacío, no tiene voz o el servicio falla', async () => {
      establecerTranscriptor(async () => ({ phrases: [] }));
      await assert.rejects(transcribirAudio({ contenido: Buffer.alloc(0) }), (e) => e.status === 400);
      await assert.rejects(transcribirAudio({ contenido: Buffer.from('a') }), (e) => e.status === 422);
      establecerTranscriptor(async () => {
        throw Object.assign(new Error('caído'), { status: 502 });
      });
      await assert.rejects(transcribirAudio({ contenido: Buffer.from('a') }), (e) => e.status === 502);
    });

    it('lee transcripciones .vtt de Teams, .txt de Meet y rechaza otros formatos', async () => {
      const vtt = 'WEBVTT\n\nNOTE exportado de Teams\n\nid-1\n00:00:02.500 --> 00:00:04.000\n<v Ana Prueba>Primera frase</v>\n\n00:00:04.000 --> 00:00:06.000\n<v Ana Prueba>y la segunda.</v>\n\n01:10.000 --> 01:12.000\nSin hablante';
      assert.equal(
        await textoDeTranscripcion({ nombre: 'reunion.vtt', contenido: Buffer.from(vtt) }),
        '[00:00:02] Ana Prueba: Primera frase y la segunda.\n\n[00:01:10] Hablante: Sin hablante',
      );
      const txt = '\uFEFFEntrevistadora: Hola\r\n\r\n\r\n\r\nPostulante: Buenos días';
      assert.equal(await textoDeTranscripcion({ nombre: 'meet.txt', contenido: Buffer.from(txt) }), 'Entrevistadora: Hola\n\nPostulante: Buenos días');
      await assert.rejects(textoDeTranscripcion({ nombre: 'audio.mp3', contenido: Buffer.from('x') }), (e) => e.status === 415);
      await assert.rejects(textoDeTranscripcion({ nombre: 'vacio.txt', contenido: Buffer.alloc(0) }), (e) => e.status === 400);
      await assert.rejects(textoDeTranscripcion({ nombre: 'mal.docx', contenido: Buffer.from('no es word') }), (e) => e.status === 422);
    });

    it('las notas de la entrevista usan el catálogo de competencias y tratan la transcripción como datos', async () => {
      const resultado = { competencias: [], temasPendientes: [], notas: 'n' };
      const cliente = clienteSimulado(respuestaJson(resultado));
      establecerClienteIa(cliente);
      const { datos } = await notasEntrevista({ transcripcion: 'Hablante 2: coordino el turno', solicitud: { cargo: 'Jefe de Centro' } });

      assert.deepEqual(datos, resultado);
      const [{ system, messages, output_config: config }] = cliente.llamadas;
      assert.match(system, /no instrucciones/);
      assert.match(messages[0].content[0].text, /<transcripcion_de_la_entrevista>\nHablante 2: coordino el turno/);
      assert.ok(config.format.schema.properties.competencias.items.properties.competencia.enum.includes('Liderazgo'));
    });
  });

  it('lee la pauta guardada: transcripción, notas y temas pendientes', () => {
    const { leerPauta } = require('../rutas/ia');
    const pauta = [
      'PAUTA DE ENTREVISTA · TRANSCRIPCIÓN',
      'Documento confidencial.',
      '',
      'NOTAS POR COMPETENCIA (propuesta de la IA, revisar)',
      '',
      'Comunicación efectiva: se expresa con claridad.',
      '',
      'Temas pendientes:',
      '- Liderazgo: sin evidencia.',
      '',
      'TRANSCRIPCIÓN',
      '',
      '[00:00:01] Hablante 1: Hola.',
      '',
    ].join('\n');
    assert.deepEqual(leerPauta(pauta), {
      transcripcion: '[00:00:01] Hablante 1: Hola.',
      notas: { competencias: [], temasPendientes: ['Liderazgo: sin evidencia.'], notas: 'Comunicación efectiva: se expresa con claridad.' },
    });
    assert.deepEqual(leerPauta('PAUTA\n\nTRANSCRIPCIÓN\n\nSolo texto.'), { transcripcion: 'Solo texto.', notas: null });
    assert.equal(leerPauta('sin formato'), null);
  });
  it('estima el costo de Claude por modelo, incluida la caché', () => {
    assert.equal(costoClaude({ modelo: 'claude-opus-5-5', entrada: 1_000_000, salida: 0 }), 4);
    assert.equal(costoClaude({ modelo: 'claude-sonnet-5-5', entrada: 0, salida: 1_000_000 }), 10);
    // Caché leída: 0,1× la entrada; escrita: 1,25×.
    assert.equal(costoClaude({ modelo: 'claude-opus-5-5', cacheLectura: 1_000_000 }), 0.4);
    assert.equal(costoClaude({ modelo: 'claude-opus-5-5', cacheEscritura: 1_000_000 }), 5);
    assert.equal(costoClaude({ modelo: 'otro-modelo', entrada: 1_000_000 }), 4, 'sin precio conocido usa el de Opus');
  });

  it('la voz no tiene costo en el plan gratis y usa AZURE_SPEECH_USD_HORA en el pagado', () => {
    const previo = process.env.AZURE_SPEECH_USD_HORA;
    delete process.env.AZURE_SPEECH_USD_HORA;
    assert.equal(costoVoz(3600), 0);
    process.env.AZURE_SPEECH_USD_HORA = '1';
    assert.equal(costoVoz(1800), 0.5);
    if (previo === undefined) delete process.env.AZURE_SPEECH_USD_HORA;
    else process.env.AZURE_SPEECH_USD_HORA = previo;
  });
});
