import { describe, expect, it, vi } from 'vitest';
import { ErrorGrabacion, iniciarGrabacion, puedeGrabar } from './grabadora';

/** Pista y flujo simulados con lo que usa la grabadora. */
const crearPista = () => {
  const oyentes = {};
  return {
    stop: vi.fn(),
    addEventListener: (nombre, fn) => {
      oyentes[nombre] = fn;
    },
    terminar: () => oyentes.ended?.(),
  };
};
const crearFlujo = ({ audio = 1, video = 0 } = {}) => {
  const audios = Array.from({ length: audio }, crearPista);
  const videos = Array.from({ length: video }, crearPista);
  return { audios, getAudioTracks: () => audios, getTracks: () => [...audios, ...videos] };
};

/** Entorno de navegador simulado: micrófono, pantalla, Web Audio y MediaRecorder. */
function crearEntorno({
  microfono = crearFlujo(),
  pantalla = crearFlujo({ audio: 1, video: 1 }),
  errorMicrofono,
} = {}) {
  const grabadoras = [];
  const conexiones = [];
  class MediaRecorder {
    static isTypeSupported = (tipo) => tipo === 'audio/webm;codecs=opus';
    constructor(flujo, opciones) {
      this.flujo = flujo;
      this.opciones = opciones;
      this.state = 'inactive';
      grabadoras.push(this);
    }
    start() {
      this.state = 'recording';
      this.ondataavailable({ data: new Blob(['parte']) });
    }
    stop() {
      this.state = 'inactive';
      this.ondataavailable({ data: new Blob(['-fin']) });
      this.onstop();
    }
  }
  const destino = { stream: { mezcla: true } };
  class AudioContext {
    createMediaStreamDestination = () => destino;
    createMediaStreamSource = (flujo) => ({ connect: (a) => conexiones.push([flujo, a]) });
    close = vi.fn();
  }
  const entorno = {
    navigator: {
      mediaDevices: {
        getUserMedia: errorMicrofono ? vi.fn().mockRejectedValue(errorMicrofono) : vi.fn().mockResolvedValue(microfono),
        getDisplayMedia: vi.fn().mockResolvedValue(pantalla),
      },
    },
    MediaRecorder,
    AudioContext,
    MediaStream: class {
      constructor(pistas) {
        this.pistas = pistas;
      }
    },
  };
  return { entorno, grabadoras, conexiones, destino, microfono, pantalla };
}

describe('grabadora', () => {
  it('detecta si el navegador puede grabar el micrófono o la reunión', () => {
    const { entorno } = crearEntorno();
    expect(puedeGrabar('microfono', entorno)).toBe(true);
    expect(puedeGrabar('reunion', entorno)).toBe(true);
    expect(puedeGrabar('reunion', { ...entorno, AudioContext: undefined })).toBe(false);
    expect(puedeGrabar('microfono', { navigator: {} })).toBe(false);
  });

  it('graba el micrófono en webm/opus y entrega el audio al detener', async () => {
    const { entorno, grabadoras, microfono } = crearEntorno();
    const grabacion = await iniciarGrabacion({ modo: 'microfono', entorno });

    expect(grabadoras[0].flujo).toBe(microfono);
    expect(grabadoras[0].opciones).toEqual({ mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 32000 });
    const audio = await grabacion.detener();
    expect(audio.type).toBe('audio/webm');
    expect(audio.size).toBe('parte-fin'.length);
    expect(microfono.audios[0].stop).toHaveBeenCalled();
    // Detener dos veces no vuelve a cortar la grabación.
    await grabacion.detener();
  });

  it('mezcla el micrófono con el audio de la pestaña y avisa si se deja de compartir', async () => {
    const { entorno, grabadoras, conexiones, destino, microfono, pantalla } = crearEntorno();
    const alTerminar = vi.fn();
    const grabacion = await iniciarGrabacion({ modo: 'reunion', alTerminar, entorno });

    expect(entorno.navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith({ video: true, audio: true });
    expect(grabadoras[0].flujo).toBe(destino.stream);
    expect(conexiones.map(([flujo]) => flujo)).toEqual([
      microfono,
      expect.objectContaining({ pistas: pantalla.audios }),
    ]);

    pantalla.audios[0].terminar();
    expect(alTerminar).toHaveBeenCalled();
    await grabacion.cancelar();
    pantalla.getTracks().forEach((pista) => expect(pista.stop).toHaveBeenCalled());
  });

  it('explica el problema si se comparte sin audio, sin permiso o sin micrófono', async () => {
    const sinAudio = crearEntorno({ pantalla: crearFlujo({ audio: 0, video: 1 }) });
    await expect(iniciarGrabacion({ modo: 'reunion', entorno: sinAudio.entorno })).rejects.toThrow(
      /compartir audio de la pestaña/i,
    );
    expect(sinAudio.microfono.audios[0].stop).toHaveBeenCalled();

    const permiso = Object.assign(new Error('x'), { name: 'NotAllowedError' });
    await expect(
      iniciarGrabacion({ modo: 'microfono', entorno: crearEntorno({ errorMicrofono: permiso }).entorno }),
    ).rejects.toThrow(/permiso para usar el micrófono/i);
    await expect(
      iniciarGrabacion({ modo: 'reunion', entorno: crearEntorno({ errorMicrofono: permiso }).entorno }),
    ).rejects.toThrow(/compartir la pestaña o el micrófono/i);
    const sinMicrofono = Object.assign(new Error('x'), { name: 'NotFoundError' });
    await expect(
      iniciarGrabacion({ modo: 'microfono', entorno: crearEntorno({ errorMicrofono: sinMicrofono }).entorno }),
    ).rejects.toThrow(/no se encontró un micrófono/i);
    await expect(
      iniciarGrabacion({ modo: 'microfono', entorno: crearEntorno({ errorMicrofono: new Error('x') }).entorno }),
    ).rejects.toBeInstanceOf(ErrorGrabacion);
    await expect(iniciarGrabacion({ modo: 'microfono', entorno: { navigator: {} } })).rejects.toThrow(
      /usa chrome o edge/i,
    );
  });
});
