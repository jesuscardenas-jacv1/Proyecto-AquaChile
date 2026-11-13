/**
 * Grabación de la entrevista en el navegador, para transcribirla después en el servidor.
 *
 * - "microfono": solo el micrófono (entrevista presencial).
 * - "reunion": el micrófono más el audio de la pestaña de Meet o Teams web, que el navegador
 *   pide compartir con getDisplayMedia. Ambas pistas se mezclan con Web Audio en una sola.
 *
 * El audio queda solo en la memoria de la página hasta enviarlo: no se guarda en el equipo
 * ni en el servidor.
 */

const TIPOS_PREFERIDOS = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'];
// ~14 MB por hora: cabe holgado en el máximo de 50 MB del servidor.
const BITS_POR_SEGUNDO = 32000;

export class ErrorGrabacion extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorGrabacion';
  }
}

/** ¿El navegador permite grabar? "reunion" además necesita compartir pantalla con audio. */
export function puedeGrabar(modo, entorno = globalThis) {
  const dispositivos = entorno.navigator?.mediaDevices;
  if (!dispositivos?.getUserMedia || typeof entorno.MediaRecorder !== 'function') return false;
  if (modo === 'reunion')
    return Boolean(dispositivos.getDisplayMedia && (entorno.AudioContext || entorno.webkitAudioContext));
  return true;
}

function tipoAdmitido(entorno) {
  const { MediaRecorder } = entorno;
  return TIPOS_PREFERIDOS.find((tipo) => MediaRecorder.isTypeSupported?.(tipo)) ?? '';
}

const detenerPistas = (...flujos) => flujos.forEach((flujo) => flujo?.getTracks().forEach((pista) => pista.stop()));

function mensajeDePermiso(error, modo) {
  if (error?.name === 'NotAllowedError') {
    return modo === 'reunion'
      ? 'No se otorgó permiso para compartir la pestaña o el micrófono.'
      : 'No se otorgó permiso para usar el micrófono. Revísalo en la barra de direcciones del navegador.';
  }
  if (error?.name === 'NotFoundError') return 'No se encontró un micrófono conectado.';
  return 'No se pudo iniciar la grabación en este navegador.';
}

/**
 * Abre el audio de la entrevista: el micrófono y, en modo "reunion", también el audio de la
 * pestaña de Meet o Teams, mezclados en un solo flujo. Lo usan la grabación y la
 * transcripción en vivo del panel de entrevista.
 * Devuelve { flujo, pistas, contexto, liberar }; `liberar()` corta el micrófono y la pestaña.
 * @param {{ modo: 'microfono' | 'reunion', entorno?: object }} opciones
 */
export async function abrirAudio({ modo, entorno = globalThis }) {
  const { mediaDevices } = entorno.navigator;
  let microfono = null;
  let pantalla = null;
  try {
    microfono = await mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    if (modo === 'reunion') {
      // Chrome exige pedir video para compartir una pestaña; solo se usa su audio.
      pantalla = await mediaDevices.getDisplayMedia({ video: true, audio: true });
      if (!pantalla.getAudioTracks().length) {
        throw new ErrorGrabacion(
          'La pestaña se compartió sin audio. Vuelve a intentarlo y marca "Compartir audio de la pestaña".',
        );
      }
    }
  } catch (error) {
    detenerPistas(microfono, pantalla);
    throw error instanceof ErrorGrabacion ? error : new ErrorGrabacion(mensajeDePermiso(error, modo));
  }

  let flujo = microfono;
  let contexto = null;
  if (pantalla) {
    const Contexto = entorno.AudioContext || entorno.webkitAudioContext;
    contexto = new Contexto();
    const destino = contexto.createMediaStreamDestination();
    contexto.createMediaStreamSource(microfono).connect(destino);
    contexto.createMediaStreamSource(new entorno.MediaStream(pantalla.getAudioTracks())).connect(destino);
    flujo = destino.stream;
  }

  return {
    flujo,
    contexto,
    // Si se deja de compartir la pestaña o se desconecta el micrófono, quien usa el audio debe terminar.
    pistas: [...(pantalla?.getTracks() ?? []), ...microfono.getAudioTracks()],
    liberar() {
      detenerPistas(microfono, pantalla);
      contexto?.close?.();
    },
  };
}

/**
 * Inicia la grabación. Devuelve { detener, cancelar }: `detener()` entrega el audio (Blob);
 * `cancelar()` lo descarta. `alTerminar` se llama si la grabación se corta sola (por ejemplo,
 * al dejar de compartir la pestaña).
 * @param {{ modo: 'microfono' | 'reunion', alTerminar?: () => void, entorno?: object }} opciones
 */
export async function iniciarGrabacion({ modo, alTerminar = () => {}, entorno = globalThis }) {
  if (!puedeGrabar(modo, entorno))
    throw new ErrorGrabacion('Este navegador no permite grabar audio. Usa Chrome o Edge.');
  const audio = await abrirAudio({ modo, entorno });
  const { flujo } = audio;

  const tipo = tipoAdmitido(entorno);
  const grabadora = new entorno.MediaRecorder(flujo, {
    ...(tipo ? { mimeType: tipo } : {}),
    audioBitsPerSecond: BITS_POR_SEGUNDO,
  });
  const partes = [];
  grabadora.ondataavailable = (evento) => {
    if (evento.data?.size) partes.push(evento.data);
  };

  let terminada = false;
  const liberar = () => audio.liberar();
  const finalizar = () =>
    new Promise((resolver) => {
      if (terminada) return resolver();
      terminada = true;
      grabadora.onstop = () => {
        liberar();
        resolver();
      };
      if (grabadora.state === 'inactive') grabadora.onstop();
      else grabadora.stop();
      return undefined;
    });

  // Si se deja de compartir la pestaña o se desconecta el micrófono, la grabación termina.
  audio.pistas.forEach((pista) => {
    pista.addEventListener?.('ended', () => {
      if (!terminada) alTerminar();
    });
  });

  grabadora.start(1000);

  return {
    tipo: tipo || 'audio/webm',
    async detener() {
      await finalizar();
      return new Blob(partes, { type: (tipo || 'audio/webm').split(';')[0] });
    },
    async cancelar() {
      await finalizar();
      partes.length = 0;
    },
  };
}
