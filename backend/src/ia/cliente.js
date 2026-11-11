/**
 * Cliente de IA (Claude, de Anthropic) para las ayudas del proceso: análisis de CV,
 * autocompletado de formularios y redacción de ofertas.
 *
 * Se activa solo si hay clave: ANTHROPIC_API_KEY en backend/.env o en la plataforma de
 * despliegue. Sin clave, `iaDisponible()` es false y la app oculta estas opciones.
 * IA_MODELO permite cambiar el modelo (por defecto Claude Opus 5.5).
 *
 * La IA solo sugiere: nada de lo que devuelve se guarda como decisión del proceso.
 */
const Anthropic = require('@anthropic-ai/sdk');

const Cliente = Anthropic.default ?? Anthropic;
const MODELO_POR_DEFECTO = 'claude-opus-5-5';
// Si el modelo declina por sus filtros de seguridad, la API reintenta con el modelo que corresponda.
const BETA_RESPALDO = 'server-side-fallback-2026-07-01';

class ErrorIa extends Error {
  constructor(mensaje, status = 502) {
    super(mensaje);
    this.name = 'ErrorIa';
    this.status = status;
  }
}

let clienteInyectado = null;
let clienteReal = null;

/** Para las pruebas: reemplaza el cliente de Anthropic por uno simulado (null lo quita). */
function establecerClienteIa(cliente) {
  clienteInyectado = cliente;
}

const modeloIa = () => process.env.IA_MODELO || MODELO_POR_DEFECTO;
const iaDisponible = () => Boolean(clienteInyectado || process.env.ANTHROPIC_API_KEY);

function obtenerCliente() {
  if (clienteInyectado) return clienteInyectado;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ErrorIa('La IA no está configurada en el servidor.', 503);
  }
  // Menos de los 230 s que Azure App Service espera una respuesta antes de cortarla.
  clienteReal ??= new Cliente({ timeout: 120_000, maxRetries: 1 });
  return clienteReal;
}

/** Traduce los errores del SDK a mensajes para la pantalla, sin exponer detalles internos. */
function traducirError(error) {
  if (error instanceof ErrorIa) return error;
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new ErrorIa('La clave de IA del servidor no es válida.', 503);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new ErrorIa('La IA recibió demasiadas solicitudes. Intenta de nuevo en un minuto.', 429);
  }
  if (error instanceof Anthropic.BadRequestError) {
    console.error('❌ Solicitud rechazada por la IA:', error.message);
    return new ErrorIa('La IA no pudo procesar este documento.', 422);
  }
  if (error instanceof Anthropic.APIConnectionError || error instanceof Anthropic.APIError) {
    console.error('❌ Error del servicio de IA:', error.message);
    return new ErrorIa('El servicio de IA no respondió. Intenta de nuevo.', 502);
  }
  return error;
}

/**
 * Pide a Claude una respuesta que cumpla un esquema JSON y la devuelve ya interpretada.
 * @param {{ sistema: string, contenido: Array, esquema: object, esfuerzo?: string }} opciones
 */
async function generarJson({ sistema, contenido, esquema, esfuerzo = 'medium' }) {
  let respuesta;
  try {
    respuesta = await obtenerCliente().beta.messages.create({
      model: modeloIa(),
      max_tokens: 16000,
      betas: [BETA_RESPALDO],
      fallbacks: 'default',
      system: sistema,
      messages: [{ role: 'user', content: contenido }],
      output_config: { effort: esfuerzo, format: { type: 'json_schema', schema: esquema } },
    });
  } catch (error) {
    throw traducirError(error);
  }

  if (respuesta.stop_reason === 'refusal') {
    throw new ErrorIa('La IA no puede procesar este contenido.', 422);
  }
  if (respuesta.stop_reason === 'max_tokens') {
    throw new ErrorIa('La respuesta de la IA quedó incompleta. Intenta de nuevo.', 502);
  }
  const texto = respuesta.content.find((bloque) => bloque.type === 'text')?.text;
  try {
    return { datos: JSON.parse(texto), modelo: respuesta.model };
  } catch {
    throw new ErrorIa('La respuesta de la IA no tiene el formato esperado.', 502);
  }
}

module.exports = { ErrorIa, establecerClienteIa, generarJson, iaDisponible, modeloIa };
