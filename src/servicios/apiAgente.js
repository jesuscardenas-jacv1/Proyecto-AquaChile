/**
 * Cliente de Marea (/api/agente). Marea no usa servicios de IA: solo necesita sesión en el servidor.
 */
import { solicitar } from './api';

export const apiAgente = {
  /** Envía un mensaje escrito o una acción (chip, hora, «Confirmar»). Responde { texto, tarjetas, opciones, foco }. */
  enviar: ({ mensaje = '', foco = null, accion = null } = {}) =>
    solicitar('/agente/mensaje', { metodo: 'POST', cuerpo: { mensaje, foco, accion } }),
  /** Avisos recientes del usuario con sus acciones: { noLeidas, avisos }. */
  avisos: () => solicitar('/agente/avisos'),
};
