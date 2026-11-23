/**
 * Cliente de Gemini (Google) para Marea: entender un mensaje (elegir una herramienta) y leer un CV
 * con un esquema JSON fijo. Es un proveedor aparte: el análisis de CV sigue con Claude (cliente.js).
 *
 * - Se activa solo con GEMINI_API_KEY en el servidor y mientras quede presupuesto (presupuesto.js).
 * - Usa generateContent, que no guarda la conversación en Google. Conviene una clave del plan pagado:
 *   en el gratuito Google puede usar los datos para mejorar sus productos.
 * - Gemini nunca consulta la base de datos ni escribe: solo devuelve un nombre de herramienta o un JSON.
 */
const { ErrorIa } = require('./cliente');
const { hayPresupuesto } = require('./presupuesto');
const { registrarGemini } = require('./uso');

const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODELO_POR_DEFECTO = 'gemini-3.5-flash-lite';

let clienteInyectado = null;

/** Para las pruebas: reemplaza la llamada HTTP por `async ({ modelo, cuerpo }) => respuesta` (null la quita). */
function establecerClienteGemini(cliente) {
  clienteInyectado = cliente;
}

const modeloGemini = () => process.env.GEMINI_MODELO || MODELO_POR_DEFECTO;
const geminiConfigurado = () => Boolean(clienteInyectado || process.env.GEMINI_API_KEY);
/** ¿Se puede llamar ahora? Hay clave y no se llegó al tope de gasto. */
const geminiDisponible = () => geminiConfigurado() && hayPresupuesto();

function errorHttp(status, mensaje) {
  console.error(`❌ Error de Gemini (${status}):`, String(mensaje ?? '').slice(0, 300));
  if (status === 401 || status === 403 || /api key/i.test(mensaje ?? '')) return new ErrorIa('La clave de Gemini del servidor no es válida.', 503);
  if (status === 404) return new ErrorIa('El modelo de Gemini configurado no existe.', 503);
  if (status === 429) return new ErrorIa('Gemini recibió demasiadas solicitudes. Intenta de nuevo en un minuto.', 429);
  if (status === 400) return new ErrorIa('Gemini no pudo procesar este contenido.', 422);
  return new ErrorIa('El servicio de Gemini no respondió. Intenta de nuevo.', 502);
}

async function llamar({ modelo, cuerpo, esperaMs }) {
  if (clienteInyectado) return clienteInyectado({ modelo, cuerpo });
  if (!process.env.GEMINI_API_KEY) throw new ErrorIa('Gemini no está configurado en el servidor.', 503);
  let respuesta;
  try {
    respuesta = await fetch(`${URL_BASE}/${encodeURIComponent(modelo)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(esperaMs),
    });
  } catch {
    throw new ErrorIa('El servicio de Gemini no respondió. Intenta de nuevo.', 502);
  }
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw errorHttp(respuesta.status, datos?.error?.message);
  return datos;
}

async function generar({ tarea, modelo, sistema, partes, esfuerzo, esperaMs, ...resto }) {
  if (!hayPresupuesto()) throw new ErrorIa('Se alcanzó el tope de gasto de Gemini.', 503);
  const respuesta = await llamar({
    modelo,
    esperaMs,
    cuerpo: {
      systemInstruction: { parts: [{ text: sistema }] },
      contents: [{ role: 'user', parts: partes }],
      ...resto,
      generationConfig: { maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: esfuerzo }, ...resto.generationConfig },
    },
  });
  registrarGemini({ tarea, modelo: respuesta.modelVersion || modelo, respuesta });
  const candidato = respuesta.candidates?.[0];
  if (respuesta.promptFeedback?.blockReason || !candidato) throw new ErrorIa('Gemini no puede procesar este contenido.', 422);
  if (candidato.finishReason === 'MAX_TOKENS') throw new ErrorIa('La respuesta de Gemini quedó incompleta. Intenta de nuevo.', 502);
  if (candidato.finishReason && candidato.finishReason !== 'STOP') throw new ErrorIa('Gemini no puede procesar este contenido.', 422);
  return { partes: candidato.content?.parts ?? [], modelo: respuesta.modelVersion || modelo };
}

/** Pide un JSON que cumpla `esquema` (JSON Schema). Devuelve { datos, modelo }. */
async function generarJsonGemini({ tarea, sistema, partes, esquema, esfuerzo = 'low', modelo = modeloGemini() }) {
  const respuesta = await generar({
    tarea, modelo, sistema, partes, esfuerzo, esperaMs: 90_000,
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: esquema },
  });
  const texto = respuesta.partes.filter((parte) => !parte.thought).map((parte) => parte.text ?? '').join('');
  try {
    return { datos: JSON.parse(texto), modelo: respuesta.modelo };
  } catch {
    throw new ErrorIa('La respuesta de Gemini no tiene el formato esperado.', 502);
  }
}

/**
 * Pide elegir UNA función de la lista cerrada `funciones` ([{ name, description, parametersJsonSchema }]).
 * Devuelve { nombre, argumentos }; el backend valida el rol y los parámetros antes de ejecutar.
 */
async function elegirHerramienta({ tarea, sistema, mensaje, funciones, esfuerzo = 'low', modelo = modeloGemini() }) {
  const { partes } = await generar({
    tarea, modelo, sistema, partes: [{ text: mensaje }], esfuerzo, esperaMs: 8_000,
    tools: [{ functionDeclarations: funciones }],
    toolConfig: { functionCallingConfig: { mode: 'ANY' } },
    generationConfig: { maxOutputTokens: 1024 },
  });
  const llamada = partes.find((parte) => parte.functionCall)?.functionCall;
  if (!llamada || !funciones.some((funcion) => funcion.name === llamada.name)) return { nombre: '', argumentos: {} };
  return { nombre: llamada.name, argumentos: llamada.args ?? {} };
}

module.exports = { elegirHerramienta, establecerClienteGemini, geminiConfigurado, geminiDisponible, generarJsonGemini, modeloGemini };
