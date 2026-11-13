/**
 * Transcripción en vivo de la entrevista con Azure AI Speech (ConversationTranscriber), para el
 * panel de entrevista. Separa a los hablantes ("Guest-1", "Guest-2") mientras se conversa.
 *
 * - El navegador pide al backend un token de 10 minutos (la clave de Azure nunca llega aquí) y
 *   lo renueva antes de que venza.
 * - El audio va directo del navegador a Azure solo para transcribirlo: no se graba ni se guarda.
 * - El SDK de Azure (pesado) se carga recién al empezar, para no agrandar el resto de la app.
 */
import { ErrorGrabacion, abrirAudio, puedeGrabar } from './grabadora';

const MARGEN_RENOVACION_SEGUNDOS = 60;

/** ¿El navegador puede transcribir en vivo con ese modo? Necesita audio y WebSocket. */
export function puedeTranscribirEnVivo(modo, entorno = globalThis) {
  return puedeGrabar(modo, entorno) && typeof entorno.WebSocket === 'function';
}

/** Mensaje claro a partir del error del SDK. */
export function mensajeErrorVoz(detalle = '') {
  if (/401|403|auth|token/i.test(detalle)) return 'El permiso de transcripción venció o no es válido. Vuelve a empezar.';
  if (/1006|connection|websocket|network/i.test(detalle)) {
    return 'Se perdió la conexión con el servicio de transcripción. Revisa internet y reanuda.';
  }
  if (/quota|429|throttl/i.test(detalle)) return 'Se alcanzó el límite del servicio de transcripción. Intenta en unos minutos.';
  return 'La transcripción en vivo se detuvo por un error del servicio. Reanuda para seguir.';
}

/** Medidor de nivel de audio (0 a 1) sobre el flujo, para mostrar que el micrófono capta voz. */
function crearMedidor(flujo, entorno) {
  const Contexto = entorno.AudioContext || entorno.webkitAudioContext;
  if (!Contexto) return { nivel: () => 0, cerrar: () => {} };
  const contexto = new Contexto();
  const analizador = contexto.createAnalyser();
  analizador.fftSize = 512;
  contexto.createMediaStreamSource(flujo).connect(analizador);
  const muestras = new Uint8Array(analizador.fftSize);
  return {
    nivel() {
      analizador.getByteTimeDomainData(muestras);
      let suma = 0;
      for (const muestra of muestras) suma += ((muestra - 128) / 128) ** 2;
      return Math.min(1, Math.sqrt(suma / muestras.length) * 4);
    },
    cerrar: () => contexto.close?.(),
  };
}

const conPromesa = (fn) => new Promise((resolver, rechazar) => fn(resolver, rechazar));

/**
 * Empieza a transcribir. Devuelve { detener, nivel }.
 * - `alSegmento({ hablante, inicioMs, texto })`: frase reconocida (final).
 * - `alParcial({ hablante, texto } | null)`: lo que se está reconociendo ("escuchando…").
 * - `alError(mensaje)`: la transcripción se cortó; quien llama decide si reanuda.
 * - `alTerminar()`: se dejó de compartir la pestaña o se desconectó el micrófono.
 * `inicioMs` desplaza las marcas de tiempo al reanudar después de una pausa.
 */
export async function iniciarTranscripcionEnVivo({
  modo,
  obtenerToken,
  inicioMs = 0,
  alSegmento,
  alParcial = () => {},
  alError = () => {},
  alTerminar = () => {},
  entorno = globalThis,
  cargarSdk = () => import('microsoft-cognitiveservices-speech-sdk'),
  abrir = abrirAudio,
}) {
  if (!puedeTranscribirEnVivo(modo, entorno)) {
    throw new ErrorGrabacion('Este navegador no permite transcribir en vivo. Usa Chrome o Edge.');
  }

  const credencial = await obtenerToken();
  const sdk = await cargarSdk();
  const audio = await abrir({ modo, entorno });

  const configuracion = sdk.SpeechConfig.fromAuthorizationToken(credencial.token, credencial.region);
  configuracion.speechRecognitionLanguage = credencial.idioma || 'es-CL';
  // Separa a los hablantes también en los resultados parciales.
  configuracion.setProperty(sdk.PropertyId.SpeechServiceResponse_DiarizeIntermediateResults, 'true');
  const transcriptor = new sdk.ConversationTranscriber(configuracion, sdk.AudioConfig.fromStreamInput(audio.flujo));
  const medidor = crearMedidor(audio.flujo, entorno);
  const hablante = (id) => (id && id !== 'Unknown' ? id : '');

  transcriptor.transcribing = (_, evento) => {
    if (evento.result?.text) alParcial({ hablante: hablante(evento.result.speakerId), texto: evento.result.text });
  };
  transcriptor.transcribed = (_, evento) => {
    const { result } = evento;
    alParcial(null);
    if (result?.reason !== sdk.ResultReason.RecognizedSpeech || !result.text?.trim()) return;
    alSegmento({
      hablante: hablante(result.speakerId),
      // El SDK entrega el desfase en unidades de 100 nanosegundos.
      inicioMs: inicioMs + Math.round((result.offset ?? 0) / 10000),
      texto: result.text.trim(),
    });
  };
  let detenido = false;
  transcriptor.canceled = (_, evento) => {
    if (!detenido && evento.reason === sdk.CancellationReason.Error) alError(mensajeErrorVoz(evento.errorDetails));
  };

  // Renueva el token antes de que venza (dura 10 minutos).
  const vigencia = Math.max((credencial.vigenciaSegundos ?? 600) - MARGEN_RENOVACION_SEGUNDOS, 30);
  const renovacion = setInterval(async () => {
    try {
      transcriptor.authorizationToken = (await obtenerToken()).token;
    } catch {
      // Si no se pudo renovar, el SDK avisará con `canceled` cuando el token venza.
    }
  }, vigencia * 1000);

  const liberar = () => {
    clearInterval(renovacion);
    medidor.cerrar();
    audio.liberar();
  };

  audio.pistas.forEach((pista) => {
    pista.addEventListener?.('ended', () => {
      if (!detenido) alTerminar();
    });
  });

  try {
    await conPromesa((ok, fallo) => transcriptor.startTranscribingAsync(ok, fallo));
  } catch (error) {
    liberar();
    transcriptor.close?.();
    throw new ErrorGrabacion(mensajeErrorVoz(String(error)));
  }

  return {
    nivel: medidor.nivel,
    async detener() {
      if (detenido) return;
      detenido = true;
      try {
        await conPromesa((ok, fallo) => transcriptor.stopTranscribingAsync(ok, fallo));
      } catch {
        // Si ya se había cortado, no hay nada que detener.
      } finally {
        transcriptor.close?.();
        liberar();
      }
    },
  };
}
