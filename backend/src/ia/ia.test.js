/**
 * Pruebas del módulo de IA con un cliente simulado: no llaman a la API real ni tienen costo.
 * Ejecutar con: npm run test:ia
 */
const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Anthropic = require('@anthropic-ai/sdk');
const { establecerClienteIa, generarJson, iaDisponible } = require('./cliente');
const { bloqueDocumento, descriptorDelCatalogo } = require('./documentos');
const { analizarCv } = require('./tareas');

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
});
