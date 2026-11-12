/**
 * Tareas de IA del proceso de selección. Cada una devuelve un JSON con forma fija
 * (esquema) para que la pantalla lo muestre o lo use para completar un formulario.
 *
 * El mensaje se arma en tres partes:
 *  1. Datos del caso (fijo): cargo, documentos, notas o transcripción.
 *  2. Indicaciones (editables por el administrador en /administracion; ver catalogo.js).
 *  3. Límites de la tarea (fijo).
 * El sistema lleva el rol de la tarea y las REGLAS_COMUNES (fijos).
 */
const { generarJson } = require('./cliente');
const { bloqueDocumento } = require('./documentos');
const { COMPETENCIAS, REGLAS_COMUNES, TAREAS } = require('./catalogo');
const { configuracionDe } = require('./configuracion');

/** Llama a Claude con la configuración vigente de la tarea. */
function ejecutar(tarea, { documentos = [], datos }) {
  const base = TAREAS[tarea];
  const config = configuracionDe(tarea);
  const instruccion = [datos, config.indicaciones, base.limites].filter(Boolean).join('\n\n');
  return generarJson({
    tarea,
    sistema: `${base.sistema}\n${REGLAS_COMUNES}`,
    contenido: [...documentos, { type: 'text', text: instruccion }],
    esquema: base.esquema,
    esfuerzo: config.esfuerzo,
    modelo: config.modelo || undefined,
  });
}

const indagar = (solicitud) =>
  solicitud.observaciones ? `Aspectos que el reclutador pidió indagar: ${solicitud.observaciones}\n` : '';
const catalogoCompetencias = () => `Catálogo de competencias: ${COMPETENCIAS.join(', ')}.`;

/**
 * Compara el CV con el descriptor del cargo. No entrega puntaje ni recomendación: muestra
 * evidencia, brechas y preguntas para que el analista y la psicóloga decidan.
 */
async function analizarCv({ cv, descriptor, oferta }) {
  const documentos = [await bloqueDocumento(cv, 'CV del postulante')];
  if (descriptor) documentos.push(await bloqueDocumento(descriptor, 'Descriptor del cargo'));
  return ejecutar('analizarCv', {
    documentos,
    datos: `Cargo al que postula: ${oferta?.cargo || 'no indicado'}${oferta?.titulo ? ` (oferta "${oferta.titulo}")` : ''}.
${descriptor ? 'Compara el CV con el descriptor del cargo.' : 'No hay descriptor del cargo: compara el CV con lo esperable para el cargo y dilo en "alertas".'}`,
  });
}

/** Extrae los datos de contacto del CV para completar el formulario del candidato. */
async function extraerDatosCv({ cv }) {
  return ejecutar('extraerDatosCv', { documentos: [await bloqueDocumento(cv, 'CV')], datos: '' });
}

/** Redacta la descripción y los requisitos de una oferta a partir del descriptor del cargo. */
async function redactarOferta({ oferta, descriptor }) {
  const documentos = descriptor ? [await bloqueDocumento(descriptor, 'Descriptor del cargo')] : [];
  return ejecutar('redactarOferta', {
    documentos,
    datos: `Cargo: ${oferta.cargo}. Familia de cargo: ${oferta.familiaCargo || 'no indicada'}. Área: ${oferta.area || 'no indicada'}.
Ubicación: ${oferta.ubicacion || 'no indicada'}. Jornada: ${oferta.jornada || 'no indicada'}.
${descriptor ? 'Básate en el descriptor del cargo.' : 'No hay descriptor: usa solo lo esperable para el cargo y sé conservador.'}`,
  });
}

/**
 * Borrador de la evaluación psicolaboral a partir de las notas de la entrevista que escribe
 * la psicóloga. Solo propone: ella revisa cada competencia y elige el resultado.
 */
async function borradorEvaluacion({ notas, solicitud, descriptor }) {
  const documentos = descriptor ? [await bloqueDocumento(descriptor, 'Descriptor del cargo')] : [];
  return ejecutar('borradorEvaluacion', {
    documentos,
    datos: `Cargo evaluado: ${solicitud.cargo} (${solicitud.familia_cargo || 'familia no indicada'}).
${indagar(solicitud)}${catalogoCompetencias()}
${descriptor ? 'Considera también el descriptor del cargo adjunto.' : 'No hay descriptor del cargo.'}

<notas_de_la_entrevista>
${notas}
</notas_de_la_entrevista>`,
  });
}

/**
 * Notas estructuradas de la entrevista a partir de su transcripción: lo que dijo el postulante
 * agrupado por competencia del catálogo, con citas breves, y un texto de notas listo para el
 * borrador de la evaluación. No evalúa ni asigna niveles: eso lo hace el borrador, con la
 * revisión de la psicóloga.
 */
async function notasEntrevista({ transcripcion, solicitud }) {
  return ejecutar('notasEntrevista', {
    datos: `Cargo evaluado: ${solicitud.cargo} (${solicitud.familia_cargo || 'familia no indicada'}).
${indagar(solicitud)}${catalogoCompetencias()}

<transcripcion_de_la_entrevista>
${transcripcion}
</transcripcion_de_la_entrevista>`,
  });
}

module.exports = { analizarCv, borradorEvaluacion, extraerDatosCv, notasEntrevista, redactarOferta };
