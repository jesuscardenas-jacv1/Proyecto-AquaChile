/**
 * Cliente de las ayudas de IA del backend (/api/ia): análisis del CV de una postulación,
 * datos de un CV para autocompletar formularios, borrador de una oferta y, en la entrevista,
 * transcripción (Azure AI Speech) y notas por competencia.
 * Sin servidor o sin clave de IA en el servidor, la app oculta estas opciones.
 */
import { useEffect, useState } from 'react';
import { ErrorApi, URL_API, guardarToken, obtenerToken } from './api';

async function llamar(ruta, { metodo = 'GET', cuerpo, cabeceras = {} } = {}) {
  const token = obtenerToken();
  if (!token) throw new ErrorApi('La IA necesita una sesión en el servidor.', { noDisponible: true });

  let respuesta;
  try {
    respuesta = await fetch(`${URL_API}${ruta}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, ...cabeceras },
      body: cuerpo,
    });
  } catch {
    throw new ErrorApi('No se pudo conectar con el servidor.', { noDisponible: true });
  }
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    if (respuesta.status === 401) guardarToken(null);
    throw new ErrorApi(datos.error ?? `Error ${respuesta.status} del servicio de IA.`, { status: respuesta.status });
  }
  return datos;
}

const json = (cuerpo) => ({ metodo: 'POST', cuerpo: JSON.stringify(cuerpo), cabeceras: { 'Content-Type': 'application/json' } });

export const apiIa = {
  conectado: () => Boolean(obtenerToken()),
  estado: () => llamar('/ia/estado'),

  /** Último análisis guardado, o null si la postulación aún no tiene uno. */
  async obtenerAnalisis(postulacionId) {
    try {
      return (await llamar(`/ia/postulaciones/${postulacionId}/analisis`)).analisis;
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  },

  analizarPostulacion: async (postulacionId) =>
    (await llamar(`/ia/postulaciones/${postulacionId}/analisis`, { metodo: 'POST' })).analisis,

  /** Datos de contacto del CV (nombre, correo, teléfono, ciudad, resumen). */
  extraerDatosCv: async (archivo) =>
    (
      await llamar(`/ia/extraer-cv?${new URLSearchParams({ nombre: archivo.name })}`, {
        metodo: 'POST',
        cuerpo: archivo,
        cabeceras: { 'Content-Type': archivo.type || 'application/octet-stream' },
      })
    ).datos,

  /** Borrador de la evaluación desde las notas de la entrevista (las notas no se guardan). */
  borradorEvaluacion: async (solicitudId, notas) =>
    (await llamar(`/ia/solicitudes/${solicitudId}/borrador-evaluacion`, json({ notas }))).borrador,

  /**
   * Transcribe el audio grabado de la entrevista (no se guarda), deja la transcripción como
   * pauta en la carpeta y devuelve { transcripcion, notas, errorNotas, archivo, ... }.
   * @param {'microfono' | 'reunion'} origen
   */
  transcribirAudio: (solicitudId, audio, origen) =>
    llamar(`/ia/solicitudes/${solicitudId}/transcripcion/audio?${new URLSearchParams({ consentimiento: 'si', origen })}`, {
      metodo: 'POST',
      cuerpo: audio,
      cabeceras: { 'Content-Type': audio.type || 'audio/webm' },
    }),

  /** Transcripción exportada de Teams o de Meet (.vtt, .docx o .txt) o el texto pegado (string). */
  /** Última transcripción guardada como pauta, con sus notas si las trae (solo lectura). */
  ultimaTranscripcion: (solicitudId) => llamar(`/ia/solicitudes/${solicitudId}/transcripcion/ultima`),

  subirTranscripcion(solicitudId, archivoOTexto) {
    const pegado = typeof archivoOTexto === 'string';
    const parametros = pegado
      ? { consentimiento: 'si', nombre: 'transcripcion.txt', origen: 'texto' }
      : { consentimiento: 'si', nombre: archivoOTexto.name };
    return llamar(`/ia/solicitudes/${solicitudId}/transcripcion?${new URLSearchParams(parametros)}`, {
      metodo: 'POST',
      cuerpo: pegado ? new Blob([archivoOTexto], { type: 'text/plain' }) : archivoOTexto,
      cabeceras: { 'Content-Type': pegado ? 'text/plain; charset=utf-8' : archivoOTexto.type || 'application/octet-stream' },
    });
  },

  /** Borrador { titulo, descripcion, requisitos } a partir del descriptor del cargo. */
  redactarOferta: async (oferta) => (await llamar('/ia/redactar-oferta', json(oferta))).oferta,
};

// Una consulta por sesión: el estado de la IA no cambia mientras el servidor sigue arriba.
const consultas = new Map();

const SIN_IA = { disponible: false, voz: false };

/**
 * { disponible, voz }: si el servidor tiene la IA (Claude) y la transcripción de voz
 * (Azure AI Speech) configuradas. Ambas son false sin servidor, sin sesión o sin clave.
 */
export function useEstadoIa(api = apiIa) {
  const [estado, setEstado] = useState(SIN_IA);

  useEffect(() => {
    if (!api.conectado()) return undefined;
    const token = obtenerToken() ?? '';
    if (!consultas.has(token) || api !== apiIa) {
      consultas.set(
        token,
        api.estado().then(
          (respuesta) => ({ disponible: Boolean(respuesta?.disponible), voz: Boolean(respuesta?.voz) }),
          () => SIN_IA,
        ),
      );
    }
    let vigente = true;
    consultas.get(token).then((valor) => vigente && setEstado(valor));
    return () => {
      vigente = false;
    };
  }, [api]);

  return estado;
}

/** true si el servidor tiene la IA configurada; false sin servidor, sin sesión o sin clave. */
export const useIaDisponible = (api = apiIa) => useEstadoIa(api).disponible;
