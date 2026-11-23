/**
 * Lista cerrada de herramientas que se le ofrecen a Gemini, con sus parámetros (JSON Schema).
 * Solo se envían las que el rol puede usar, y nunca las que escriben (confirmar_agenda, elegir_hora):
 * esas llegan únicamente desde un botón. El backend vuelve a validar el rol y cada parámetro.
 */
const { AGRUPACIONES, ESTADOS } = require('../conocimiento/consultas');
const { TIPOS_EVENTO } = require('../bd/eventos');
const { HERRAMIENTAS, puedeUsar } = require('./herramientas');

const texto = (description) => ({ type: 'string', description });
const opciones = (valores, description) => ({ type: 'string', enum: valores, description });
const SOLICITUD = { solicitudId: { type: 'integer', description: 'Número de la solicitud, si lo dice' } };
const AGENDA = {
  ...SOLICITUD,
  fecha: texto('Fecha pedida, YYYY-MM-DD'),
  hora: texto('Hora pedida, HH:MM en 24 h'),
  modalidad: opciones(['Google Meet', 'Teams', 'Presencial'], 'Modalidad, si la dice'),
};
const FILTROS = {
  ciudad: texto('Ciudad o comuna de residencia'),
  habilidades: { type: 'array', items: { type: 'string' }, description: 'Herramientas, conocimientos, licencias, certificaciones o idiomas' },
  cargo: texto('Cargo al que postula'),
  estado: opciones(ESTADOS, 'Estado del proceso'),
  desde: texto('Solo desde esta fecha, YYYY-MM-DD'),
  textoLibre: texto('Palabras clave de experiencia que no sean una habilidad concreta (p. ej. "bodega frigorífica")'),
};

const DECLARACIONES = {
  buscar_candidatos: ['Busca personas por ciudad, habilidades, cargo, estado o experiencia.', FILTROS],
  estadisticas: ['Cuenta personas (cuántas hay), con filtros o agrupadas.', { ...FILTROS, agruparPor: opciones(AGRUPACIONES, 'Cómo agrupar los conteos') }],
  perfil_candidato: ['Muestra el perfil profesional de una persona nombrada.', SOLICITUD],
  actividad_reciente: ['Muestra lo último que pasó en la plataforma.', { desde: FILTROS.desde, tipoEvento: opciones(Object.keys(TIPOS_EVENTO), 'Tipo de evento, si lo pide') }],
  agendar: ['Agenda la entrevista de una persona.', AGENDA],
  reagendar: ['Cambia la hora de una entrevista ya agendada.', AGENDA],
  resumen_solicitud: ['Dice cómo va la solicitud o el proceso de una persona nombrada.', SOLICITUD],
  analizar_candidato: ['Muestra el análisis del CV de una persona frente al cargo.', { ...SOLICITUD, tambienAgendar: { type: 'boolean', description: 'true si además pide agendar' } }],
  ranking_cargo: ['Ordena a los postulantes de un cargo por % de requisitos.', { cargo: texto('Cargo') }],
  guia_entrevista: ['Da la guía o las preguntas para entrevistar a una persona.', SOLICITUD],
  redactar_oferta: ['Prepara un borrador de oferta de empleo.', { cargo: texto('Cargo') }],
  listar_solicitudes: ['Lista las solicitudes recientes o pendientes.', {}],
  avisos: ['Muestra los avisos o notificaciones del usuario.', {}],
};

const declaracion = (name, [description, properties]) => ({ name, description, parametersJsonSchema: { type: 'object', properties } });

/** Funciones que puede elegir Gemini para este rol. */
const funcionesDelRol = (rol) => [
  ...Object.entries(DECLARACIONES)
    .filter(([nombre]) => HERRAMIENTAS[nombre] && !HERRAMIENTAS[nombre].soloAccion && puedeUsar(rol, nombre))
    .map(([nombre, datos]) => declaracion(nombre, datos)),
  declaracion('ayuda', ['Saluda o pregunta qué puede hacer Marea.', {}]),
  declaracion('fuera_de_alcance', ['El mensaje no corresponde a ninguna otra función.', {}]),
];

module.exports = { DECLARACIONES, funcionesDelRol };
