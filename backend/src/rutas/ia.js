const express = require('express');
const db = require('../bd/conexion');
const { autenticar, requerirRol } = require('../middlewares/auth');
const { limitarPorIp } = require('../middlewares/limite');
const { obtenerAlmacenamiento } = require('../almacenamiento');
const {
  categoriaDeArchivo,
  claveCarpeta,
  claveCarpetaPostulacion,
  nombreArchivo,
  nombreCarpeta,
} = require('../almacenamiento/comun');
const { ErrorIa, iaDisponible, modeloIa } = require('../ia/cliente');
const { buscarDescriptor, textoDeTranscripcion } = require('../ia/documentos');
const { analizarCv, borradorEvaluacion, extraerDatosCv, notasEntrevista, redactarOferta } = require('../ia/tareas');
const { transcribirAudio, vozDisponible } = require('../ia/voz');

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

/** GET /api/ia/estado — si la IA y la transcripción de voz están disponibles, para mostrar u ocultar sus opciones. */
router.get('/estado', (req, res) => {
  res.json({ ok: true, disponible: iaDisponible(), modelo: iaDisponible() ? modeloIa() : null, voz: vozDisponible() });
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

// ─── Entrevista con IA (línea A): transcripción y notas para el borrador ───────────────

const MEGABYTE = 1024 * 1024;
const AUDIO_MAXIMO = 50 * MEGABYTE;
const TRANSCRIPCION_MAXIMA_CARACTERES = 150000;
const leerAudio = express.raw({ type: () => true, limit: AUDIO_MAXIMO + 1024 });
const leerTranscripcion = express.raw({ type: () => true, limit: 2 * MEGABYTE + 1024 });
const TIPOS_AUDIO = ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'audio/mp3', 'video/webm'];

const ORIGENES = {
  microfono: 'Grabación del micrófono (entrevista presencial)',
  reunion: 'Grabación del micrófono y del audio de la reunión en línea (Meet o Teams web)',
  archivo: 'Transcripción exportada de Teams o de Meet',
  texto: 'Transcripción pegada como texto',
};

function exigirVoz(req, res, next) {
  if (!vozDisponible()) return res.status(503).json({ error: 'La transcripción de voz no está configurada en el servidor.' });
  return next();
}

/** Fecha y hora de Chile, legible: "11-11-2026 16:30". */
const fechaChile = (fecha = new Date()) =>
  fecha
    .toLocaleString('sv-SE', { timeZone: 'America/Santiago' })
    .slice(0, 16)
    .replace(/^(\d{4})-(\d{2})-(\d{2})/, '$3-$2-$1');
const marcaArchivo = (fecha = new Date()) =>
  fecha.toLocaleString('sv-SE', { timeZone: 'America/Santiago' }).slice(0, 16).replace(':', '.');

/** Solicitud abierta en que la psicóloga confirmó el consentimiento del postulante. */
function solicitudParaEntrevista(req) {
  const id = Number(req.params.id);
  const solicitud = db
    .prepare('SELECT s.*, c.nombre AS candidato FROM solicitudes s JOIN candidatos c ON c.id = s.candidato_id WHERE s.id = ?')
    .get(id);
  if (!solicitud) throw new ErrorIa(`Solicitud #${id} no encontrada.`, 404);
  if (solicitud.motivo_cierre) throw new ErrorIa('La solicitud se cerró sin evaluación.', 409);
  // Ley 21.719: sin el consentimiento explícito del postulante no se graba ni se transcribe.
  if (req.query.consentimiento !== 'si') {
    throw new ErrorIa('Confirma que el postulante aceptó que se grabe la entrevista.', 400);
  }
  return solicitud;
}

const TITULO_NOTAS = 'NOTAS POR COMPETENCIA (propuesta de la IA, revisar)';
const TITULO_TEMAS = 'Temas pendientes:';
const TITULO_TRANSCRIPCION = 'TRANSCRIPCIÓN';
const PREFIJO_PAUTA_TRANSCRIPCION = 'Transcripción entrevista';

/**
 * Lee una pauta de transcripción guardada (el texto que arma `textoPauta`): devuelve la
 * transcripción y, si la pauta las trae, las notas y los temas pendientes que propuso la IA.
 */
function leerPauta(texto) {
  const marca = `\n${TITULO_TRANSCRIPCION}\n\n`;
  const inicioTranscripcion = texto.indexOf(marca);
  if (inicioTranscripcion < 0) return null;
  const transcripcion = texto.slice(inicioTranscripcion + marca.length).trim();
  const encabezado = texto.slice(0, inicioTranscripcion);
  const inicioNotas = encabezado.indexOf(`${TITULO_NOTAS}\n\n`);
  if (inicioNotas < 0) return { transcripcion, notas: null };

  const bloque = encabezado.slice(inicioNotas + TITULO_NOTAS.length + 2);
  const inicioTemas = bloque.indexOf(`\n${TITULO_TEMAS}\n`);
  const notas = (inicioTemas < 0 ? bloque : bloque.slice(0, inicioTemas)).trim();
  const temasPendientes =
    inicioTemas < 0
      ? []
      : bloque
          .slice(inicioTemas + TITULO_TEMAS.length + 2)
          .split('\n')
          .filter((linea) => linea.startsWith('- '))
          .map((linea) => linea.slice(2).trim());
  return { transcripcion, notas: notas ? { competencias: [], temasPendientes, notas } : null };
}

function textoPauta({ solicitud, origen, nombreOriginal, idioma, usuario, fecha, transcripcion, notas }) {
  const lineas = [
    'PAUTA DE ENTREVISTA · TRANSCRIPCIÓN',
    'Documento confidencial: solo lo ven la psicóloga evaluadora y el administrador.',
    '',
    `Solicitud: ${claveCarpeta(solicitud.id)} · Cargo: ${solicitud.cargo} · Candidato: ${solicitud.candidato}`,
    `Fecha: ${fechaChile(fecha)}`,
    `Origen: ${ORIGENES[origen]}${nombreOriginal ? ` (${nombreOriginal})` : ''}`,
    ...(idioma ? [`Idioma reconocido: ${idioma}`] : []),
    `Consentimiento: el postulante aceptó que se grabe la entrevista. Lo confirmó ${usuario.nombre} (${usuario.correo}) el ${fechaChile(fecha)}.`,
    ...(origen === 'microfono' || origen === 'reunion'
      ? ['El audio no se guardó: se envió a Azure AI Speech solo para transcribirlo.']
      : []),
    '',
  ];
  if (notas) {
    lineas.push(TITULO_NOTAS, '', notas.notas, '');
    if (notas.temasPendientes.length) {
      lineas.push(TITULO_TEMAS, ...notas.temasPendientes.map((tema) => `- ${tema}`), '');
    }
  }
  lineas.push(TITULO_TRANSCRIPCION, '', transcripcion, '');
  return lineas.join('\n');
}

/**
 * Pide las notas por competencia (si la IA está disponible), guarda la transcripción como
 * pauta de entrevista en la carpeta de la solicitud y responde con ambas.
 */
async function guardarYResponder(req, res, { solicitud, origen, nombreOriginal = '', transcripcion, idioma = null, extra = {} }) {
  if (transcripcion.length > TRANSCRIPCION_MAXIMA_CARACTERES) {
    throw new ErrorIa('La transcripción supera los 150.000 caracteres. Divide la entrevista en partes.', 413);
  }

  let notas = null;
  let errorNotas = null;
  if (iaDisponible()) {
    try {
      const { datos } = await notasEntrevista({ transcripcion, solicitud });
      const vistas = new Set();
      notas = {
        competencias: datos.competencias
          .filter(({ competencia }) => !vistas.has(competencia) && vistas.add(competencia))
          .map((item) => ({
            competencia: item.competencia,
            observacion: recortar(item.observacion),
            citas: item.citas.slice(0, 3).map((cita) => recortar(cita, 300)),
          })),
        temasPendientes: datos.temasPendientes.slice(0, 10).map((tema) => recortar(tema, 300)),
        notas: recortar(datos.notas, LARGO_MAXIMO_NOTAS),
      };
    } catch (error) {
      // La transcripción vale por sí sola: se guarda aunque las notas fallen.
      if (!(error instanceof ErrorIa)) throw error;
      errorNotas = error.message;
    }
  }

  const fecha = new Date();
  const almacenamiento = obtenerAlmacenamiento();
  const carpeta = await almacenamiento.obtenerCarpeta(
    claveCarpeta(solicitud.id),
    nombreCarpeta(solicitud.id, solicitud.candidato),
    { crear: true },
  );
  const archivo = await almacenamiento.subirArchivo(
    carpeta,
    nombreArchivo('pauta', `${PREFIJO_PAUTA_TRANSCRIPCION} ${marcaArchivo(fecha)}.txt`),
    Buffer.from(textoPauta({ solicitud, origen, nombreOriginal, idioma, usuario: req.usuario, fecha, transcripcion, notas }), 'utf8'),
  );

  res.status(201).json({
    ok: true,
    transcripcion,
    notas,
    errorNotas,
    archivo: { ...archivo, puedeEliminar: true },
    consentimiento: { confirmadoPor: req.usuario.nombre ?? '', fecha: fecha.toISOString() },
    ...extra,
  });
}

/**
 * POST /api/ia/solicitudes/:id/transcripcion/audio?consentimiento=si&origen=microfono|reunion
 * Cuerpo: el audio grabado en el navegador (webm u ogg, hasta 50 MB). Lo transcribe con
 * Azure AI Speech, guarda la transcripción como pauta y devuelve las notas por competencia.
 * El audio no se guarda. Exclusivo de la psicóloga (y del administrador).
 */
router.post(
  '/solicitudes/:id/transcripcion/audio',
  requerirRol('evaluador'),
  exigirVoz,
  limite,
  leerAudio,
  manejar(async (req, res) => {
    const solicitud = solicitudParaEntrevista(req);
    const origen = req.query.origen === 'reunion' ? 'reunion' : 'microfono';
    const tipo = String(req.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
    if (!TIPOS_AUDIO.includes(tipo)) {
      throw new ErrorIa('El audio debe ser webm, ogg, wav o mp3.', 415);
    }
    const contenido = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const extension = tipo.split('/')[1].replace('x-', '').replace('mpeg', 'mp3').replace('wave', 'wav');
    const resultado = await transcribirAudio({ contenido, nombre: `entrevista.${extension}`, tipo });

    await guardarYResponder(req, res, {
      solicitud,
      origen,
      transcripcion: resultado.texto,
      idioma: resultado.idioma,
      extra: { idioma: resultado.idioma, duracionMs: resultado.duracionMs, hablantes: resultado.hablantes },
    });
  }),
);

/**
 * POST /api/ia/solicitudes/:id/transcripcion?consentimiento=si&nombre=reunion.vtt
 * Cuerpo: una transcripción exportada de Teams o de Meet (.vtt, .docx o .txt), o el texto
 * pegado (nombre terminado en .txt). La guarda como pauta y devuelve las notas por competencia.
 */
router.post(
  '/solicitudes/:id/transcripcion',
  requerirRol('evaluador'),
  limite,
  leerTranscripcion,
  manejar(async (req, res) => {
    const solicitud = solicitudParaEntrevista(req);
    const nombre = texto(req.query.nombre) || 'transcripcion.txt';
    const contenido = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const transcripcion = await textoDeTranscripcion({ nombre, contenido });
    if (transcripcion.length < LARGO_MINIMO_NOTAS) {
      throw new ErrorIa('La transcripción es demasiado corta.', 400);
    }
    const pegado = req.query.origen === 'texto';
    await guardarYResponder(req, res, {
      solicitud,
      origen: pegado ? 'texto' : 'archivo',
      nombreOriginal: pegado ? '' : nombre,
      transcripcion,
    });
  }),
);

/**
 * GET /api/ia/solicitudes/:id/transcripcion/ultima
 * Última transcripción guardada como pauta, con las notas que propuso la IA si las trae.
 * Permite pasarlas al borrador después de marcar la entrevista como realizada, sin volver a
 * grabar ni llamar a la IA. Solo lectura; exclusivo de la psicóloga (y del administrador).
 */
router.get(
  '/solicitudes/:id/transcripcion/ultima',
  requerirRol('evaluador'),
  manejar(async (req, res) => {
    const id = Number(req.params.id);
    if (!db.prepare('SELECT id FROM solicitudes WHERE id = ?').get(id)) {
      throw new ErrorIa(`Solicitud #${id} no encontrada.`, 404);
    }
    const almacenamiento = obtenerAlmacenamiento();
    const carpeta = await almacenamiento.obtenerCarpeta(claveCarpeta(id), null);
    const pautas = carpeta
      ? (await almacenamiento.listarArchivos(carpeta)).filter(
          (archivo) => archivo.categoria === 'pauta' && archivo.nombre.includes(PREFIJO_PAUTA_TRANSCRIPCION),
        )
      : [];
    if (!pautas.length) throw new ErrorIa('Esta solicitud aún no tiene una transcripción guardada.', 404);

    // El nombre lleva la fecha y hora ("2026-11-12 00.08"): el mayor es el más reciente.
    const ultima = pautas.sort((a, b) => b.nombre.localeCompare(a.nombre))[0];
    const { contenido } = await almacenamiento.descargarArchivo(carpeta, ultima.id);
    const pauta = leerPauta(contenido.toString('utf8'));
    if (!pauta) throw new ErrorIa('La pauta guardada no tiene el formato esperado.', 422);

    res.json({ ok: true, ...pauta, archivo: { id: ultima.id, nombre: ultima.nombre, modificado: ultima.modificado } });
  }),
);

module.exports = router;
module.exports.leerPauta = leerPauta;
