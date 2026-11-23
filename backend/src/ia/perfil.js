/**
 * Tarea `perfilCandidato`: Gemini lee un CV una sola vez y devuelve el perfil profesional con un
 * esquema fijo, sin datos sensibles. Se normaliza y se guarda en la base de conocimiento.
 */
const db = require('../bd/conexion');
const { registrarEvento } = require('../bd/eventos');
const { obtenerAlmacenamiento } = require('../almacenamiento');
const { categoriaDeArchivo, claveCarpeta } = require('../almacenamiento/comun');
const { guardarPerfil } = require('../conocimiento/perfiles');
const { cvDePostulacion } = require('./analisisPostulacion');
const { REGLAS_COMUNES, TAREAS } = require('./catalogo');
const { ErrorIa } = require('./cliente');
const { configuracionDe } = require('./configuracion');
const { bloqueDocumento } = require('./documentos');
const { generarJsonGemini } = require('./gemini');

/** CV que el analista subió a la carpeta de la solicitud (candidato sin portal). */
async function cvDeSolicitud(id) {
  const almacenamiento = obtenerAlmacenamiento();
  const carpeta = await almacenamiento.obtenerCarpeta(claveCarpeta(id), null);
  const archivo = carpeta
    ? (await almacenamiento.listarArchivos(carpeta)).find((item) => categoriaDeArchivo(item.nombre) === 'cv')
    : null;
  return archivo ? almacenamiento.descargarArchivo(carpeta, archivo.id) : null;
}

/** El mismo documento que se prepara para Claude, con la forma que espera Gemini. */
async function parteDocumento(cv) {
  const { source } = await bloqueDocumento(cv, 'CV');
  return source.type === 'base64'
    ? { inlineData: { mimeType: source.media_type, data: source.data } }
    : { text: `<cv>\n${source.data}\n</cv>` };
}

async function extraerPerfil(cv) {
  const base = TAREAS.perfilCandidato;
  const config = configuracionDe('perfilCandidato');
  return generarJsonGemini({
    tarea: 'perfilCandidato',
    sistema: `${base.sistema}\n${REGLAS_COMUNES}\n${base.limites}`,
    partes: [await parteDocumento(cv), { text: config.indicaciones }],
    esquema: base.esquema,
    esfuerzo: config.esfuerzo,
    modelo: config.modelo || undefined,
  });
}

/** Extrae y guarda el perfil. Lanza ErrorIa 404 si no hay CV. */
async function extraerYGuardar({ candidatoId, postulacionId = null, solicitudId = null }) {
  const candidato = db.prepare('SELECT id, nombre FROM candidatos WHERE id = ?').get(candidatoId);
  if (!candidato) throw new ErrorIa(`Candidato #${candidatoId} no encontrado.`, 404);
  const cv = (postulacionId ? await cvDePostulacion(postulacionId) : null) ?? (solicitudId ? await cvDeSolicitud(solicitudId) : null);
  if (!cv) throw new ErrorIa('El candidato no tiene un CV cargado.', 404);
  const { datos, modelo } = await extraerPerfil(cv);
  const perfil = guardarPerfil(candidatoId, datos, { postulacionId, modelo });
  registrarEvento({ tipo: 'perfil_extraido', entidad: 'candidato', entidadId: candidatoId, usuario: 'Base de conocimiento', detalle: candidato.nombre });
  return perfil;
}

module.exports = { extraerYGuardar };
