/**
 * Canal en tiempo real con el servidor (Server-Sent Events, ver backend/src/tiempoReal.js).
 *
 * Una sola conexión por navegador. Llegan dos tipos de evento:
 * - `notificacion`: un aviso nuevo para el usuario.
 * - `datos`: hubo cambios en la información; las pantallas deben volver a traerla.
 *
 * Si la conexión se corta, reintenta con una pausa creciente (hasta 30 s). Si la sesión
 * venció (401), se detiene: el inicio de sesión volverá a abrirla.
 */
import { URL_API, obtenerToken } from './api';

const PAUSA_INICIAL_MS = 2000;
const PAUSA_MAXIMA_MS = 30000;

const oyentes = new Map();
let controlador = null;
let temporizador = null;
let pausa = PAUSA_INICIAL_MS;

/**
 * Separa los eventos completos de un fragmento recibido. Lo que no está completo queda en `resto`.
 * @returns {{ eventos: Array<{tipo: string, datos: any}>, resto: string }}
 */
export function analizarEventos(fragmento) {
  const bloques = fragmento.split('\n\n');
  const resto = bloques.pop() ?? '';
  const eventos = bloques
    .map((bloque) => {
      const tipo = bloque.match(/^event: (.+)$/m)?.[1]?.trim();
      const linea = bloque.match(/^data: (.+)$/m)?.[1];
      if (!tipo || !linea) return null;
      try {
        return { tipo, datos: JSON.parse(linea) };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return { eventos, resto };
}

/** Avisa a quien escucha un tipo de evento. Un error en un oyente no afecta a los demás. */
function emitir(tipo, datos) {
  (oyentes.get(tipo) ?? new Set()).forEach((oyente) => {
    try {
      oyente(datos);
    } catch {
      // Un oyente con error no debe cortar la conexión.
    }
  });
}

/** Escucha un tipo de evento. Devuelve la función que deja de escuchar. */
export function suscribirTiempoReal(tipo, oyente) {
  if (!oyentes.has(tipo)) oyentes.set(tipo, new Set());
  oyentes.get(tipo).add(oyente);
  return () => oyentes.get(tipo)?.delete(oyente);
}

async function conectarUnaVez(token, controlActual) {
  const respuesta = await fetch(`${URL_API}/eventos`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: controlActual.signal,
  });
  if (respuesta.status === 401) {
    const error = new Error('sesion-vencida');
    error.sesionVencida = true;
    throw error;
  }
  if (!respuesta.ok || !respuesta.body) throw new Error('sin-conexion');

  pausa = PAUSA_INICIAL_MS;
  const lector = respuesta.body.getReader();
  const decodificador = new TextDecoder();
  let pendiente = '';
  for (;;) {
    const { value, done } = await lector.read();
    if (done) throw new Error('conexion-cerrada');
    pendiente += decodificador.decode(value, { stream: true }).replace(/\r\n/g, '\n');
    const { eventos, resto } = analizarEventos(pendiente);
    pendiente = resto;
    eventos.forEach(({ tipo, datos }) => emitir(tipo, datos));
  }
}

function programarReintento(controlActual) {
  temporizador = setTimeout(() => {
    if (controlador === controlActual) ciclo(controlActual);
  }, pausa);
  pausa = Math.min(pausa * 2, PAUSA_MAXIMA_MS);
}

async function ciclo(controlActual) {
  const token = obtenerToken();
  if (!token) return;
  try {
    await conectarUnaVez(token, controlActual);
  } catch (error) {
    if (error.sesionVencida) {
      controlador = null;
      return;
    }
  }
  if (controlador === controlActual) programarReintento(controlActual);
}

/** Abre la conexión si hay sesión y no está abierta ya. */
export function iniciarTiempoReal() {
  if (controlador || !obtenerToken()) return;
  const controlActual = new AbortController();
  controlador = controlActual;
  ciclo(controlActual);
}

/** Cierra la conexión (al cerrar sesión). */
export function detenerTiempoReal() {
  clearTimeout(temporizador);
  pausa = PAUSA_INICIAL_MS;
  const actual = controlador;
  controlador = null;
  actual?.abort();
}
