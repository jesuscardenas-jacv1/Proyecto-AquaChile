/**
 * Análisis del CV de una postulación contra el descriptor del cargo, y su guardado en analisis_cv.
 * Lo usan el botón «Analizar CV» del analista (ruta /api/ia) y la cola automática (colaAnalisis.js).
 */
const db = require('../bd/conexion');
const { obtenerAlmacenamiento } = require('../almacenamiento');
const { categoriaDeArchivo, claveCarpetaPostulacion } = require('../almacenamiento/comun');
const { ErrorIa } = require('./cliente');
const { buscarDescriptor } = require('./documentos');
const { analizarCv } = require('./tareas');

/** Busca el CV que el postulante subió desde el portal. Devuelve null si no hay. */
async function cvDePostulacion(id) {
  const almacenamiento = obtenerAlmacenamiento();
  const carpeta = await almacenamiento.obtenerCarpeta(claveCarpetaPostulacion(id), null);
  const archivo = carpeta
    ? (await almacenamiento.listarArchivos(carpeta)).find((item) => categoriaDeArchivo(item.nombre) === 'cv')
    : null;
  return archivo ? almacenamiento.descargarArchivo(carpeta, archivo.id) : null;
}

/**
 * Analiza y guarda (reemplaza el análisis anterior). Devuelve la fila de analisis_cv.
 * Lanza ErrorIa 404 si la postulación o su CV no existen.
 */
async function analizarYGuardar(id, { creadoPor = '' } = {}) {
  const postulacion = db.prepare('SELECT * FROM postulaciones WHERE id = ?').get(id);
  if (!postulacion) throw new ErrorIa(`Postulación #${id} no encontrada.`, 404);
  const oferta = db.prepare('SELECT * FROM ofertas WHERE id = ?').get(postulacion.oferta_id);

  const cv = await cvDePostulacion(id);
  if (!cv) throw new ErrorIa('El postulante no tiene un CV cargado.', 404);
  const descriptor = await buscarDescriptor({ cargo: oferta?.cargo, ofertaId: oferta?.id });

  const { datos, modelo } = await analizarCv({ cv, descriptor, oferta });
  db.prepare(
    `INSERT INTO analisis_cv (postulacion_id, resultado, modelo, descriptor, creado_por, creado_en)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(postulacion_id) DO UPDATE SET
       resultado = excluded.resultado, modelo = excluded.modelo, descriptor = excluded.descriptor,
       creado_por = excluded.creado_por, creado_en = excluded.creado_en`,
  ).run(id, JSON.stringify(datos), modelo, descriptor?.nombre ?? '', creadoPor);
  // Si estaba en la cola automática, ya no hace falta.
  db.prepare(
    `UPDATE cola_analisis_cv SET estado = 'listo', terminado_en = datetime('now'), ultimo_error = ''
     WHERE postulacion_id = ? AND estado <> 'procesando'`,
  ).run(id);
  return db.prepare('SELECT * FROM analisis_cv WHERE postulacion_id = ?').get(id);
}

module.exports = { analizarYGuardar, cvDePostulacion };
