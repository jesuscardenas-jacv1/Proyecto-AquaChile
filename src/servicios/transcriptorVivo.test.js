import { afterEach, describe, expect, it, vi } from 'vitest';
import { iniciarTranscripcionEnVivo, mensajeErrorVoz, puedeTranscribirEnVivo } from './transcriptorVivo';

/** SDK de Azure Speech simulado con lo que usa el transcriptor. */
function crearSdk({ falloAlIniciar = false } = {}) {
  const transcriptores = [];
  class ConversationTranscriber {
    constructor(configuracion, audio) {
      this.configuracion = configuracion;
      this.audio = audio;
      this.close = vi.fn();
      transcriptores.push(this);
    }
    startTranscribingAsync(ok, fallo) {
      if (falloAlIniciar) fallo('WebSocket error 1006');
      else ok();
    }
    stopTranscribingAsync(ok) {
      this.detenido = true;
      ok();
    }
  }
  return {
    transcriptores,
    SpeechConfig: {
      fromAuthorizationToken: (token, region) => ({ token, region, propiedades: {}, setProperty(c, v) { this.propiedades[c] = v; } }),
    },
    AudioConfig: { fromStreamInput: (flujo) => ({ flujo }) },
    PropertyId: { SpeechServiceResponse_DiarizeIntermediateResults: 'diarizar' },
    ResultReason: { RecognizedSpeech: 3 },
    CancellationReason: { Error: 1 },
    ConversationTranscriber,
  };
}

const entorno = {
  navigator: { mediaDevices: { getUserMedia: () => {}, getDisplayMedia: () => {} } },
  MediaRecorder: function MediaRecorder() {},
  AudioContext: function AudioContext() {},
  WebSocket: function WebSocket() {},
};

function crearAudio() {
  const oyentes = [];
  return {
    flujo: { id: 'flujo' },
    pistas: [{ addEventListener: (_, fn) => oyentes.push(fn) }],
    liberar: vi.fn(),
    cortar: () => oyentes.forEach((fn) => fn()),
  };
}

const credencial = { token: 'token-1', region: 'eastus2', idioma: 'es-CL', vigenciaSegundos: 600 };

afterEach(() => vi.useRealTimers());

describe('transcriptorVivo', () => {
  it('necesita audio y WebSocket en el navegador', () => {
    expect(puedeTranscribirEnVivo('microfono', entorno)).toBe(true);
    expect(puedeTranscribirEnVivo('microfono', { ...entorno, WebSocket: undefined })).toBe(false);
    expect(puedeTranscribirEnVivo('microfono', {})).toBe(false);
  });

  it('traduce los errores del servicio a mensajes claros', () => {
    expect(mensajeErrorVoz('HTTP 401 Unauthorized')).toMatch(/venció/);
    expect(mensajeErrorVoz('WebSocket error 1006')).toMatch(/conexión/);
    expect(mensajeErrorVoz('Quota exceeded')).toMatch(/límite/);
    expect(mensajeErrorVoz('otra cosa')).toMatch(/error del servicio/);
  });

  it('transcribe con el token del backend y entrega frases con hablante y hora', async () => {
    const sdk = crearSdk();
    const audio = crearAudio();
    const alSegmento = vi.fn();
    const alParcial = vi.fn();
    const control = await iniciarTranscripcionEnVivo({
      modo: 'microfono',
      obtenerToken: async () => credencial,
      inicioMs: 60_000,
      alSegmento,
      alParcial,
      entorno: { ...entorno, AudioContext: undefined },
      cargarSdk: async () => sdk,
      abrir: async () => audio,
    });
    const [transcriptor] = sdk.transcriptores;
    expect(transcriptor.configuracion).toMatchObject({ token: 'token-1', region: 'eastus2', speechRecognitionLanguage: 'es-CL' });
    expect(transcriptor.configuracion.propiedades.diarizar).toBe('true');
    expect(transcriptor.audio.flujo).toBe(audio.flujo);

    transcriptor.transcribing(null, { result: { text: 'Yo coordino', speakerId: 'Guest-2' } });
    expect(alParcial).toHaveBeenLastCalledWith({ hablante: 'Guest-2', texto: 'Yo coordino' });
    // Desfase de 5 s en unidades de 100 ns, sumado al inicio (1 minuto).
    transcriptor.transcribed(null, { result: { reason: 3, text: ' Yo coordino el turno. ', speakerId: 'Guest-2', offset: 50_000_000 } });
    expect(alSegmento).toHaveBeenCalledWith({ hablante: 'Guest-2', inicioMs: 65_000, texto: 'Yo coordino el turno.' });
    expect(alParcial).toHaveBeenLastCalledWith(null);
    transcriptor.transcribed(null, { result: { reason: 0, text: '' } });
    transcriptor.transcribed(null, { result: { reason: 3, text: 'Sin hablante', speakerId: 'Unknown', offset: 0 } });
    expect(alSegmento).toHaveBeenLastCalledWith({ hablante: '', inicioMs: 60_000, texto: 'Sin hablante' });

    expect(control.nivel()).toBe(0);
    await control.detener();
    expect(transcriptor.detenido).toBe(true);
    expect(transcriptor.close).toHaveBeenCalled();
    expect(audio.liberar).toHaveBeenCalled();
  });

  it('renueva el token antes de que venza y avisa errores y cortes', async () => {
    vi.useFakeTimers();
    const sdk = crearSdk();
    const audio = crearAudio();
    const obtenerToken = vi.fn().mockResolvedValueOnce(credencial).mockResolvedValue({ ...credencial, token: 'token-2' });
    const alError = vi.fn();
    const alTerminar = vi.fn();
    const control = await iniciarTranscripcionEnVivo({
      modo: 'microfono',
      obtenerToken,
      alSegmento: vi.fn(),
      alError,
      alTerminar,
      entorno: { ...entorno, AudioContext: undefined },
      cargarSdk: async () => sdk,
      abrir: async () => audio,
    });
    const [transcriptor] = sdk.transcriptores;
    await vi.advanceTimersByTimeAsync(540_000);
    expect(transcriptor.authorizationToken).toBe('token-2');

    transcriptor.canceled(null, { reason: 1, errorDetails: 'WebSocket error 1006' });
    expect(alError).toHaveBeenCalledWith(expect.stringMatching(/conexión/));
    audio.cortar();
    expect(alTerminar).toHaveBeenCalled();
    await control.detener();
    await control.detener();
    audio.cortar();
    expect(alTerminar).toHaveBeenCalledTimes(1);
  });

  it('si no puede conectarse libera el audio y lanza un error claro', async () => {
    const audio = crearAudio();
    await expect(
      iniciarTranscripcionEnVivo({
        modo: 'microfono',
        obtenerToken: async () => credencial,
        alSegmento: vi.fn(),
        entorno: { ...entorno, AudioContext: undefined },
        cargarSdk: async () => crearSdk({ falloAlIniciar: true }),
        abrir: async () => audio,
      }),
    ).rejects.toThrow(/conexión/);
    expect(audio.liberar).toHaveBeenCalled();
    await expect(
      iniciarTranscripcionEnVivo({ modo: 'microfono', obtenerToken: vi.fn(), entorno: {} }),
    ).rejects.toThrow(/Chrome o Edge/);
  });
});
