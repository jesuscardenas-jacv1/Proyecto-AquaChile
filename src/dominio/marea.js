/**
 * Lógica pura de Marea en el frontend: funciones por rol (tarjetas de conexión), nombre del módulo
 * que se está viendo, atajo de teclado, tema claro/oscuro y textos de bienvenida.
 * Las respuestas las arma el backend (/api/agente); aquí no hay datos de personas.
 */
import { moduloDeRuta } from './modulos';

const NOMBRES_MODULO = {
  dashboard: 'Dashboard',
  planner: 'Planner',
  ofertas: 'Ofertas',
  postulaciones: 'Postulaciones',
  candidatos: 'Candidatos',
  solicitudes: 'Solicitudes',
  administracion: 'Administración',
};

/** Nombre del módulo de la ruta actual ("/planner/entrevista/3" → "Planner"). */
export const nombreModulo = (ruta) => NOMBRES_MODULO[moduloDeRuta(ruta)];

/**
 * Funciones de Marea. `accion` es lo que se envía al backend al elegir la tarjeta; los roles son
 * los mismos que valida el backend (el admin ve todas).
 */
export const CONEXIONES = [
  { id: 'agenda', nombre: 'Agenda y Google Meet', detalle: 'Agendar entrevistas', icono: 'bi-calendar-event', roles: ['evaluador'], accion: { tipo: 'agendar' } },
  { id: 'cv', nombre: 'Análisis de CV', detalle: 'Ranking por % de requisitos', icono: 'bi-file-earmark-bar-graph', roles: ['analista'], accion: { tipo: 'ranking_cargo' } },
  { id: 'solicitudes', nombre: 'Solicitudes y Planner', detalle: 'Resumen de una solicitud', icono: 'bi-clipboard-check', roles: ['analista', 'evaluador', 'jefatura'], accion: { tipo: 'listar_solicitudes' } },
  { id: 'guia', nombre: 'Guía de entrevista', detalle: 'Preguntas desde las brechas', icono: 'bi-chat-square-text', roles: ['evaluador'], accion: { tipo: 'guia_entrevista' } },
  { id: 'ofertas', nombre: 'Ofertas', detalle: 'Borrador de una oferta', icono: 'bi-megaphone', roles: ['analista'], accion: { tipo: 'redactar_oferta' } },
];

export const conexionesDelRol = (rol) => CONEXIONES.filter((c) => rol === 'admin' || c.roles.includes(rol));

/** Ctrl K (o Cmd K en Mac) abre y cierra Marea. */
export const esAtajoMarea = (evento) => Boolean(evento.ctrlKey || evento.metaKey) && evento.key?.toLowerCase() === 'k';

const CLAVE_TEMA = 'marea-tema';

/** Tema guardado por el usuario: 'claro' (por defecto) u 'oscuro'. */
export function leerTema(almacen = globalThis.localStorage) {
  try {
    return almacen?.getItem(CLAVE_TEMA) === 'oscuro' ? 'oscuro' : 'claro';
  } catch {
    return 'claro';
  }
}

export function guardarTema(tema, almacen = globalThis.localStorage) {
  try {
    almacen?.setItem(CLAVE_TEMA, tema);
  } catch {
    // Sin almacenamiento (modo privado): el tema vale solo para esta visita.
  }
}

export const primerNombre = (nombre = '') => nombre.trim().split(/\s+/)[0] ?? '';

const SUBTITULOS = ['Elige una función o escríbeme lo que necesites.', '¿Qué avanzamos hoy?'];

/** Subtítulo de la bienvenida: si hay avisos, invita a revisarlos; si no, varía entre dos frases. */
export function subtituloBienvenida(noLeidas = 0, azar = Math.random) {
  if (noLeidas > 0) return `Tienes ${noLeidas} aviso${noLeidas === 1 ? '' : 's'} sin revisar. ¿Partimos por ahí?`;
  return SUBTITULOS[Math.floor(azar() * SUBTITULOS.length)] ?? SUBTITULOS[0];
}
