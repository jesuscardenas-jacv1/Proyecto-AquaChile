const express = require('express');
const db = require('../bd/conexion');
const { autenticar, requerirRol } = require('../middlewares/auth');
const { limitarPorIp } = require('../middlewares/limite');
const { obtenerAlmacenamiento } = require('../almacenamiento');
const { categoriaDeArchivo, claveCarpetaPostulacion } = require('../almacenamiento/comun');
const { ErrorIa, iaDisponible, modeloIa } = require('../ia/cliente');
const { buscarDescriptor } = require('../ia/documentos');
const { analizarCv, borradorEvaluacion, extraerDatosCv, redactarOferta } = require('../ia/tareas');

/**
 * Ayudas de IA. Para el analista (fase 1): análisis del CV contra el descriptor del cargo,
 * datos del CV para autocompletar el formulario y borrador de una oferta. Para la psicóloga
 * (fase 2): borrador de la evaluación a partir de sus notas de la entrevista.
 * Son sugerencias: el sistema no toma ninguna decisión con ellas.
 */
const router = express.Router();
router.use(autenticar);

const manejar = (fn) => (req, res, next) => fn(req, res).catch(next);
// Cada llamada a la IA tiene costo: se limita por IP como el portal público.
const limite = limitarPorIp({ maximo: 20, ventanaMs: 10 * 60 * 1000 });
const leerArchivo = express.raw({ type: () => true, limit: 10 * 1024 * 1024 + 1024 });
const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

function exigirIa(req, res, next) {
  // Respuesta esperada cuando no hay clave: no se registra como error del servidor.
  if (!iaDisponible()) return res.status(503).json({ error: 'La IA no está configurada en el servidor.' });
  return next();
}

const formatearAnalisis = (fila) => ({
  postulacionId: fila.postulacion_id,
  resultado: JSON.parse(fila.resultado),
  modelo: fila.modelo,
  descriptor: fila.descriptor,
  creadoPor: fila.creado_por,
  creadoEn: fila.creado_en,
});

/** GET /api/ia/estado — si la IA está disponible, para mostrar u ocultar sus opciones. */
router.get('/estado', (req, res) => {
  res.json({ ok: true, disponible: iaDisponible(), modelo: iaDisponible() ? modeloIa() : null });
});

/** GET /api/ia/postulaciones/:id/analisis — último análisis guardado del CV (analista y jefatura). */
router.get('/postulaciones/:id/analisis', requerirRol('analista', 'jefatura'), (req, res) => {
  const fila = db.prepare('SELECT * FROM analisis_cv WHERE postulacion_id = ?').get(Number(req.params.id));
  if (!fila) return res.status(404).json({ error: 'Esta postulación aún no tiene análisis.' });
  return res.json({ ok: true, analisis: formatearAnalisis(fila) });
});

/**
 * POST /api/ia/postulaciones/:id/analisis
 * Analiza el CV de la postulación contra el descriptor del cargo y guarda el resultado.
 */
router.post(
  '/postulaciones/:id/analisis',
  requerirRol('analista'),
  exigirIa,
  limite,
  manejar(async (req, res) => {
    const id = Number(req.params.id);
    const postulacion = db.prepare('SELECT * FROM postulaciones WHERE id = ?').get(id);
    if (!postulacion) throw new ErrorIa(`Postulación #${id} no encontrada.`, 404);
    const oferta = db.prepare('SELECT * FROM ofertas WHERE id = ?').get(postulacion.oferta_id);

    const almacenamiento = obtenerAlmacenamiento();
    const carpeta = await almacenamiento.obtenerCarpeta(claveCarpetaPostulacion(id), null);
    const archivoCv = carpeta
      ? (await almacenamiento.listarArchivos(carpeta)).find((archivo) => categoriaDeArchivo(archivo.nombre) === 'cv')
      : null;
    if (!archivoCv) throw new ErrorIa('El postulante no tiene un CV cargado.', 404);
    const cv = await almacenamiento.descargarArchivo(carpeta, archivoCv.id);
    const descriptor = await buscarDescriptor({ cargo: oferta?.cargo, ofertaId: oferta?.id });

    const { datos, modelo } = await analizarCv({ cv, descriptor, oferta });
    db.prepare(
      `INSERT INTO analisis_cv (postulacion_id, resultado, modelo, descriptor, creado_por, creado_en)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(postulacion_id) DO UPDATE SET
         resultado = excluded.resultado, modelo = excluded.modelo, descriptor = excluded.descriptor,
         creado_por = excluded.creado_por, creado_en = excluded.creado_en`,
    ).run(id, JSON.stringify(datos), modelo, descriptor?.nombre ?? '', req.usuario.nombre ?? '');

    const fila = db.prepare('SELECT * FROM analisis_cv WHERE postulacion_id = ?').get(id);
    res.status(201).json({ ok: true, analisis: formatearAnalisis(fila) });
  }),
);

/**
 * POST /api/ia/extraer-cv?nombre=cv.pdf
 * Cuerpo: el CV en binario (PDF o Word). Devuelve sus datos de contacto; no guarda nada.
 */
router.post(
  '/extraer-cv',
  requerirRol('analista'),
  exigirIa,
  limite,
  leerArchivo,
  manejar(async (req, res) => {
    const contenido = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const { datos } = await extraerDatosCv({ cv: { nombre: texto(req.query.nombre) || 'cv', contenido } });
    res.json({ ok: true, datos });
  }),
);

/**
 * POST /api/ia/redactar-oferta
 * Cuerpo JSON: { cargo, familiaCargo, area, ubicacion, jornada, ofertaId? }.
 * Devuelve un borrador { titulo, descripcion, requisitos } basado en el descriptor del cargo.
 */
router.post(
  '/redactar-oferta',
  requerirRol('analista'),
  exigirIa,
  limite,
  manejar(async (req, res) => {
    const oferta = {
      cargo: texto(req.body?.cargo),
      familiaCargo: texto(req.body?.familiaCargo),
      area: texto(req.body?.area),
      ubicacion: texto(req.body?.ubicacion),
      jornada: texto(req.body?.jornada),
    };
    if (oferta.cargo.length < 2) throw new ErrorIa('Indica el cargo para redactar la oferta.', 400);
    const descriptor = await buscarDescriptor({ cargo: oferta.cargo, ofertaId: Number(req.body?.ofertaId) || null });
    const { datos } = await redactarOferta({ oferta, descriptor });
    res.json({ ok: true, oferta: datos, descriptor: descriptor?.nombre ?? '' });
  }),
);

const LARGO_MINIMO_NOTAS = 30;
const LARGO_MAXIMO_NOTAS = 20000;
const recortar = (valor, maximo = 600) => (typeof valor === 'string' ? valor.trim().slice(0, maximo) : '');

/**
 * POST /api/ia/solicitudes/:id/borrador-evaluacion
 * Cuerpo JSON: { notas }. Devuelve un borrador de la evaluación (competencias, observaciones
 * y un resultado sugerido). Las notas no se guardan: solo se envían a la IA (Exclusivo Evaluador).
 */
router.post(
  '/solicitudes/:id/borrador-evaluacion',
  requerirRol('evaluador'),
  exigirIa,
  limite,
  manejar(async (req, res) => {
    const id = Number(req.params.id);
    const solicitud = db.prepare('SELECT * FROM solicitudes WHERE id = ?').get(id);
    if (!solicitud) throw new ErrorIa(`Solicitud #${id} no encontrada.`, 404);
    if (solicitud.motivo_cierre) throw new ErrorIa('La solicitud se cerró sin evaluación.', 409);

    const notas = texto(req.body?.notas);
    if (notas.length < LARGO_MINIMO_NOTAS) {
      throw new ErrorIa('Escribe tus notas de la entrevista (al menos unas líneas) para generar el borrador.', 400);
    }
    if (notas.length > LARGO_MAXIMO_NOTAS) {
      throw new ErrorIa('Las notas superan los 20.000 caracteres. Resume o divide el texto.', 413);
    }

    const descriptor = await buscarDescriptor({ cargo: solicitud.cargo });
    const { datos } = await borradorEvaluacion({ notas, solicitud, descriptor });
    // Mismo límite de texto que acepta la evaluación al guardarse (src/bd/competencias.js).
    const vistas = new Set();
    const competencias = datos.competencias
      .filter(({ competencia }) => !vistas.has(competencia) && vistas.add(competencia))
      .map((item) => ({
        competencia: item.competencia,
        nivel: item.nivel,
        fortalezas: recortar(item.fortalezas),
        oportunidades: recortar(item.oportunidades),
        evidencia: recortar(item.evidencia, 300),
      }));

    res.json({
      ok: true,
      borrador: { ...datos, competencias, observaciones: recortar(datos.observaciones, 2000) },
      descriptor: descriptor?.nombre ?? '',
    });
  }),
);

module.exports = router;
