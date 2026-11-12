/**
 * Transcripción de la entrevista con Azure AI Speech (API de transcripción rápida).
 *
 * Se activa solo con AZURE_SPEECH_KEY y AZURE_SPEECH_REGION en backend/.env o en la
 * plataforma de despliegue. Sin ellas, `vozDisponible()` es false y la app oculta la grabación.
 *
 * El audio se envía a Azure solo para transcribirlo y no se guarda en ninguna parte:
 * lo que queda en la carpeta de la solicitud es el texto (pauta de entrevista).
 */
const { ErrorIa } = require('./cliente');
const { registrarVoz } = require('./uso');

const VERSION_API = '2024-11-15';
// Español de Chile primero; si el servicio no lo admite en la región, se prueba el siguiente.
const IDIOMAS = ['es-CL', 'es-MX', 'es-ES'];
const MAXIMO_HABLANTES = 4;

let transcriptorInyectado = null;

/** Para las pruebas: reemplaza la llamada a Azure por una función simulada (null la quita). */
function establecerTranscriptor(transcriptor) {
  transcriptorInyectado = transcriptor;
}

const vozDisponible = () =>
  Boolean(transcriptorInyectado || (process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION));

/** "00:01:05" a partir de milisegundos. */
function marcaDeTiempo(milisegundos = 0) {
  const total = Math.max(0, Math.floor(milisegundos / 1000));
  const partes = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
  return partes.map((parte) => String(parte).padStart(2, '0')).join(':');
}

/**
 * Une las frases seguidas de un mismo hablante en un solo turno.
 * @param {Array<{ hablante?: number, inicioMs?: number, texto: string }>} frases
 */
function agruparTurnos(frases) {
  const turnos = [];
  for (const frase of frases) {
    const texto = String(frase.texto ?? '').trim();
    if (!texto) continue;
    const ultimo = turnos.at(-1);
    if (ultimo && ultimo.hablante === frase.hablante) ultimo.texto += ` ${texto}`;
    else turnos.push({ hablante: frase.hablante, inicioMs: frase.inicioMs ?? 0, texto });
  }
  return turnos;
}

/** Texto legible: "[00:00:04] Hablante 1: …", un turno por párrafo. */
function textoDeTurnos(turnos) {
  return turnos
    .map(({ hablante, inicioMs, texto }) => {
      const quien = typeof hablante === 'number' ? `Hablante ${hablante}` : hablante || 'Hablante';
      return `[${marcaDeTiempo(inicioMs)}] ${quien}: ${texto}`;
    })
    .join('\n\n');
}

/** Llamada REST a la transcripción rápida de Azure con un idioma. */
async function llamarAzure({ contenido, nombre, tipo, idioma }) {
  const region = process.env.AZURE_SPEECH_REGION;
  const url = `https://${region}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=${VERSION_API}`;
  const formulario = new FormData();
  formulario.append('audio', new Blob([contenido], { type: tipo || 'application/octet-stream' }), nombre || 'entrevista.webm');
  formulario.append(
    'definition',
    JSON.stringify({ locales: [idioma], diarization: { enabled: true, maxSpeakers: MAXIMO_HABLANTES } }),
  );

  let respuesta;
  try {
    respuesta = await fetch(url, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY },
      body: formulario,
      // Menos de los 230 s que Azure App Service espera una respuesta antes de cortarla.
      signal: AbortSignal.timeout(200_000),
    });
  } catch (error) {
    console.error('❌ Azure Speech no respondió:', error.message);
    throw new ErrorIa('El servicio de transcripción no respondió. Intenta de nuevo.', 502);
  }

  const datos = await respuesta.json().catch(() => ({}));
  if (respuesta.ok) return datos;

  const detalle = `${datos?.error?.code ?? ''} ${datos?.error?.message ?? datos?.message ?? ''}`.trim();
  if (respuesta.status === 400 && /locale|language/i.test(detalle)) {
    const error = new ErrorIa('Idioma no admitido.', 400);
    error.idiomaNoAdmitido = true;
    throw error;
  }
  console.error(`❌ Azure Speech respondió ${respuesta.status}:`, detalle);
  if (respuesta.status === 401 || respuesta.status === 403) {
    throw new ErrorIa('La clave del servicio de transcripción no es válida.', 503);
  }
  if (respuesta.status === 429) {
    throw new ErrorIa('Se alcanzó el límite del servicio de transcripción. Intenta en unos minutos.', 429);
  }
  if (respuesta.status === 400 || respuesta.status === 415 || respuesta.status === 422) {
    throw new ErrorIa('No se pudo transcribir el audio. Verifica que tenga voz y un formato admitido (webm, ogg, wav o mp3).', 422);
  }
  throw new ErrorIa('El servicio de transcripción falló. Intenta de nuevo.', 502);
}

/** Pasa la respuesta de Azure a frases { hablante, inicioMs, texto }. */
function frasesDeAzure(datos) {
  const frases = (datos?.phrases ?? []).map((frase) => ({
    hablante: frase.speaker ?? null,
    inicioMs: frase.offsetMilliseconds ?? 0,
    texto: frase.text ?? '',
  }));
  if (frases.length) return frases;
  const combinado = (datos?.combinedPhrases ?? []).map((frase) => frase.text).join(' ');
  return combinado.trim() ? [{ hablante: null, inicioMs: 0, texto: combinado }] : [];
}

/**
 * Transcribe el audio de una entrevista.
 * @param {{ contenido: Buffer, nombre?: string, tipo?: string }} audio
 * @returns {Promise<{ texto: string, turnos: object[], idioma: string, duracionMs: number, hablantes: number }>}
 */
async function transcribirAudio({ contenido, nombre, tipo }) {
  if (!vozDisponible()) throw new ErrorIa('La transcripción de voz no está configurada en el servidor.', 503);
  if (!contenido?.length) throw new ErrorIa('El audio está vacío.', 400);

  const transcriptor = transcriptorInyectado ?? llamarAzure;
  let datos = null;
  let idioma = null;
  for (const candidato of IDIOMAS) {
    try {
      datos = await transcriptor({ contenido, nombre, tipo, idioma: candidato });
      idioma = candidato;
      break;
    } catch (error) {
      if (!error.idiomaNoAdmitido) throw error;
    }
  }
  if (!datos) throw new ErrorIa('El servicio de transcripción no admite español en esta región.', 502);

  const duracionMs = datos.durationMilliseconds ?? 0;
  // Azure cobra por audio procesado, aunque no reconozca voz.
  registrarVoz({ segundos: duracionMs / 1000, idioma });
  const turnos = agruparTurnos(frasesDeAzure(datos));
  if (!turnos.length) throw new ErrorIa('No se reconoció voz en el audio. Revisa el micrófono e intenta de nuevo.', 422);
  return {
    texto: textoDeTurnos(turnos),
    turnos,
    idioma,
    duracionMs,
    hablantes: new Set(turnos.map((turno) => turno.hablante).filter(Boolean)).size,
  };
}

module.exports = {
  IDIOMAS,
  agruparTurnos,
  establecerTranscriptor,
  marcaDeTiempo,
  textoDeTurnos,
  transcribirAudio,
  vozDisponible,
};
