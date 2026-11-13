/**
 * Cliente del panel de entrevista: lo guardado de la entrevista (notas, transcripción en vivo,
 * preguntas hechas), el token de voz para transcribir en vivo y el cierre con IA.
 * Sin sesión en el servidor (modo local, p. ej. demostración sin backend) las notas se guardan
 * solo en este navegador y no hay transcripción ni IA.
 */
import { ErrorApi, obtenerToken, solicitar } from './api';

const CLAVE_LOCAL = (solicitudId) => `aquachile_entrevista_${solicitudId}`;

export const entrevistaVacia = (solicitudId) => ({
  solicitudId,
  notas: '',
  transcripcion: [],
  preguntas: [],
  hablantes: {},
  segundosAudio: 0,
  actualizadoEn: null,
});

function leerLocal(solicitudId) {
  try {
    return { ...entrevistaVacia(solicitudId), ...JSON.parse(localStorage.getItem(CLAVE_LOCAL(solicitudId)) ?? '{}') };
  } catch {
    return entrevistaVacia(solicitudId);
  }
}

export const apiEntrevista = {
  conectado: () => Boolean(obtenerToken()),

  /** { entrevista, analisis, tienePostulacion }: lo guardado y el análisis del CV (o null). */
  async obtener(solicitudId) {
    if (!this.conectado()) return { entrevista: leerLocal(solicitudId), analisis: null, tienePostulacion: false };
    const { entrevista, analisis, tienePostulacion } = await solicitar(`/entrevistas/${solicitudId}`);
    return { entrevista, analisis, tienePostulacion };
  },

  /** Guarda lo que lleva la entrevista. Devuelve la entrevista guardada. */
  async guardar(solicitudId, datos) {
    if (!this.conectado()) {
      const guardada = { ...entrevistaVacia(solicitudId), ...datos, actualizadoEn: new Date().toISOString() };
      try {
        localStorage.setItem(CLAVE_LOCAL(solicitudId), JSON.stringify(guardada));
      } catch {
        throw new ErrorApi('No se pudieron guardar las notas en este navegador.');
      }
      return guardada;
    }
    return (await solicitar(`/entrevistas/${solicitudId}`, { metodo: 'PUT', cuerpo: datos })).entrevista;
  },

  /** Token de Azure Speech (10 minutos) para transcribir en vivo. */
  tokenVoz: () => solicitar('/ia/voz/token', { metodo: 'POST' }),

  /**
   * Cierra la entrevista: con transcripción, la guarda como pauta y propone notas por
   * competencia con IA. Devuelve { transcripcion, notas, errorNotas, archivo }.
   */
  cerrar: (solicitudId, { transcripcion, notas, segundosAudio, consentimiento }) =>
    solicitar(`/ia/solicitudes/${solicitudId}/entrevista/cierre`, {
      metodo: 'POST',
      cuerpo: { transcripcion, notas, segundosAudio, consentimiento },
    }),
};
