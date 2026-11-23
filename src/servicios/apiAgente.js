/**
 * Cliente de Marea (/api/agente). Solo necesita sesión en el servidor (Gemini es opcional y vive en el backend).
 */
import { solicitar } from './api';

export const apiAgente = {
  /** Envía un mensaje escrito o una acción (chip, hora, «Confirmar»). Responde { texto, tarjetas, opciones, foco }. */
  enviar: ({ mensaje = '', foco = null, accion = null } = {}) =>
    solicitar('/agente/mensaje', { metodo: 'POST', cuerpo: { mensaje, foco, accion } }),
  /** Avisos recientes del usuario con sus acciones: { noLeidas, avisos }. */
  avisos: () => solicitar('/agente/avisos'),
  /** Los avisos son las notificaciones del usuario: se marcan leídos como en la campana del menú. */
  marcarLeido: (id) => solicitar(`/notificaciones/${id}/leida`, { metodo: 'PATCH' }),
  marcarTodos: () => solicitar('/notificaciones/leidas', { metodo: 'POST' }),
};
