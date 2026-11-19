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
 * los mismos que valida el backend (el admin ve todas). `porPersona`: trabaja con una persona, así
 * que al elegirla con alguien en el foco se pregunta "¿Seguimos con…?".
 */
export const CONEXIONES = [
  { id: 'agenda', nombre: 'Agenda y Google Meet', detalle: 'Agendar entrevistas', icono: 'bi-calendar-event', roles: ['evaluador'], accion: { tipo: 'agendar' }, porPersona: true },
  { id: 'cv', nombre: 'Análisis de CV', detalle: 'Ranking por % de requisitos', icono: 'bi-file-earmark-bar-graph', roles: ['analista'], accion: { tipo: 'ranking_cargo' } },
  { id: 'solicitudes', nombre: 'Solicitudes y Planner', detalle: 'Resumen de una solicitud', icono: 'bi-clipboard-check', roles: ['analista', 'evaluador', 'jefatura'], accion: { tipo: 'listar_solicitudes' } },
  { id: 'guia', nombre: 'Guía de entrevista', detalle: 'Preguntas desde las brechas', icono: 'bi-chat-square-text', roles: ['evaluador'], accion: { tipo: 'guia_entrevista' }, porPersona: true },
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

/** Acción de una función aplicada a la persona del foco (se sigue con ella sin volver a pedirla). */
export const accionConFoco = (conexion, foco) => ({
  ...conexion.accion,
  ...(foco?.solicitudId ? { solicitudId: foco.solicitudId } : { candidatoId: foco?.candidatoId }),
});

/** "2026-11-23" → "lunes 23-11". */
export function fechaLarga(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '')) return fecha ?? '';
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const nombre = new Intl.DateTimeFormat('es-CL', { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(anio, mes - 1, dia)));
  return `${nombre} ${fecha.slice(8, 10)}-${fecha.slice(5, 7)}`;
}

/** Separa la última línea "Fuente: …" del texto de Marea, para mostrarla aparte. */
export function separarFuente(texto = '') {
  const lineas = texto.split('\n');
  const ultima = lineas[lineas.length - 1] ?? '';
  return ultima.startsWith('Fuente: ')
    ? { texto: lineas.slice(0, -1).join('\n'), fuente: ultima.slice('Fuente: '.length) }
    : { texto, fuente: '' };
}

const ARRIBA_PX = 40;
const UMBRAL_BAJADA_PX = 6;

/**
 * ¿La barra queda minimizada tras un scroll? Bajar la minimiza; volver arriba de la página la
 * muestra entera. Subir sin llegar arriba la deja como estaba (se abre pinchando el logo).
 * `esPagina`: el scroll es de la página (no de una lista interna, que no cuenta para "arriba").
 */
export function minimizarAlDesplazar({ y, anterior, minimizada, esPagina = true }) {
  if (esPagina && y <= ARRIBA_PX) return false;
  if (y - anterior > UMBRAL_BAJADA_PX) return true;
  return minimizada;
}

/** Porcentaje entre 0 y 100 para dibujar barras y anillos. */
export const porcentajeVisible = (valor) => Math.min(100, Math.max(0, Math.round(Number(valor) || 0)));
