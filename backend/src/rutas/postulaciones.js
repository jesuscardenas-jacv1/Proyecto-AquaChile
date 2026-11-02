const express = require('express');
const db = require('../bd/conexion');
const { autenticar, requerirRol } = require('../middlewares/auth');
const { formatearPostulacion } = require('../bd/formatos');
const { obtenerAlmacenamiento } = require('../almacenamiento');
const {
  ErrorAlmacenamiento,
  TAMANO_MAXIMO_CV_PORTAL,
  categoriaDeArchivo,
  claveCarpetaPostulacion,
  nombreArchivo,
  nombreCarpetaPostulacion,
  validarCvPortal,
} = require('../almacenamiento/comun');
const { limitarPorIp } = require('../middlewares/limite');

/**
 * Postulaciones del portal "Trabaja con nosotros".
 * - Públicas (sin sesión, limitadas por IP): postular y subir el CV.
 * - Con sesión: la bandeja del analista (la jefatura solo consulta) y el cambio de estado.
 * El CV queda en una carpeta de postulación (P0001 - Nombre) hasta que el analista
 * la pasa a evaluación; ahí se copia a la carpeta de la solicitud.
 */
const router = express.Router();

const leerArchivo = express.raw({ type: () => true, limit: TAMANO_MAXIMO_CV_PORTAL + 1024 });
const limite = limitarPorIp({ maximo: 10, ventanaMs: 10 * 60 * 1000 });
const limitePostular = limitarPorIp({ maximo: 10, ventanaMs: 10 * 60 * 1000 });

const ESTADOS = ['Recibida', 'En evaluación', 'Descartada'];
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const TELEFONO_VALIDO = /^\+?[0-9]{8,15}$/;
const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');
const obtener = (id) => db.prepare('SELECT * FROM postulaciones WHERE id = ?').get(id);

function validarPostulante(datos) {
  if (texto(datos.nombre).length < 3) return 'Ingresa tu nombre completo.';
  if (!CORREO_VALIDO.test(texto(datos.correo))) return 'El correo no tiene un formato válido.';
  if (!TELEFONO_VALIDO.test(texto(datos.telefono).replace(/[\s-]/g, ''))) {
    return 'El teléfono debe contener solo números (8 a 15 dígitos).';
  }
  if (!texto(datos.ciudad)) return 'Indica tu ciudad de residencia.';
  if (!['Interno', 'Externo'].includes(datos.origen)) return 'Indica si trabajas actualmente en AquaChile.';
  if (datos.consentimiento !== true) {
    return 'Debes aceptar el uso de tus datos para el proceso de selección.';
  }
  return null;
}

/**
 * POST /api/postulaciones
 * Público. Registra la postulación a una oferta abierta. Si ya existe un candidato
 * con el mismo correo se reutiliza; si no, se crea con el cargo de la oferta.
 * Responde solo el id de la postulación (para subir el CV), sin datos internos.
 */
router.post('/', limitePostular, (req, res) => {
  const datos = req.body ?? {};
  const error = validarPostulante(datos);
  if (error) return res.status(400).json({ error });

  const oferta = db.prepare("SELECT * FROM ofertas WHERE id = ? AND estado = 'Abierta'").get(Number(datos.ofertaId));
  if (!oferta) {
    return res.status(404).json({ error: 'La oferta no existe o ya cerró su proceso de postulación.' });
  }

  const correo = texto(datos.correo).toLowerCase();
  db.exec('BEGIN TRANSACTION;');
  try {
    const existente = db.prepare('SELECT id FROM candidatos WHERE correo = ?').get(correo);
    const candidatoId = existente
      ? existente.id
      : db
          .prepare(
            `INSERT INTO candidatos (nombre, correo, telefono, cargo, familia_cargo, origen)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            texto(datos.nombre),
            correo,
            texto(datos.telefono).replace(/[\s-]/g, ''),
            oferta.cargo,
            oferta.familia_cargo,
            datos.origen,
          ).lastInsertRowid;

    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO postulaciones (oferta_id, candidato_id, fecha_postulacion, estado, ciudad, cv_nombre)
         VALUES (?, ?, ?, 'Recibida', ?, ?)`,
      )
      .run(oferta.id, candidatoId, new Date().toISOString().slice(0, 10), texto(datos.ciudad), texto(datos.cvNombre));
    db.exec('COMMIT;');

    res.status(201).json({ ok: true, mensaje: 'Postulación recibida.', postulacion: { id: Number(lastInsertRowid) } });
  } catch (excepcion) {
    db.exec('ROLLBACK;');
    throw excepcion;
  }
});

/**
 * GET /api/postulaciones
 * Bandeja de postulaciones: analista (y admin) gestionan, la jefatura consulta.
 */
router.get('/', autenticar, requerirRol('analista', 'jefatura'), (req, res) => {
  const postulaciones = db
    .prepare('SELECT * FROM postulaciones ORDER BY fecha_postulacion DESC, id DESC')
    .all()
    .map(formatearPostulacion);
  res.json({ ok: true, total: postulaciones.length, postulaciones });
});

/**
 * PATCH /api/postulaciones/:id
 * El analista descarta, reactiva o pasa a evaluación (con la solicitud creada).
 */
router.patch('/:id', autenticar, requerirRol('analista'), (req, res) => {
  const id = Number(req.params.id);
  const actual = obtener(id);
  if (!actual) return res.status(404).json({ error: `Postulación #${id} no encontrada.` });

  const { estado } = req.body;
  if (estado !== undefined && !ESTADOS.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Debe ser uno de: ${ESTADOS.join(', ')}.` });
  }
  let solicitudId = actual.solicitud_id;
  if ('solicitudId' in req.body) {
    solicitudId = req.body.solicitudId === null ? null : Number(req.body.solicitudId);
    if (solicitudId !== null && !db.prepare('SELECT id FROM solicitudes WHERE id = ?').get(solicitudId)) {
      return res.status(404).json({ error: `La solicitud #${req.body.solicitudId} no existe.` });
    }
  }

  db.prepare('UPDATE postulaciones SET estado = ?, solicitud_id = ? WHERE id = ?').run(
    estado ?? actual.estado,
    solicitudId,
    id,
  );
  res.json({ ok: true, postulacion: formatearPostulacion(obtener(id)) });
});

const manejar = (fn) => (req, res, next) => fn(req, res).catch(next);

/**
 * POST /api/postulaciones/:id/cv?nombre=cv.pdf
 * Cuerpo: el archivo en binario. Público, limitado por IP, solo PDF o Word de hasta 5 MB.
 */
router.post(
  '/:id/cv',
  limite,
  leerArchivo,
  manejar(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new ErrorAlmacenamiento('Id de postulación inválido.', 400);
    }
    // Solo se acepta el CV de una postulación que existe y sigue recibida.
    const postulacion = obtener(id);
    if (!postulacion || postulacion.estado !== 'Recibida') {
      throw new ErrorAlmacenamiento('La postulación no existe o ya no recibe documentos.', 404);
    }
    const contenido = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    validarCvPortal({ nombre: req.query.nombre, tamano: contenido.length });

    let candidato = '';
    try {
      candidato = decodeURIComponent(req.get('X-Candidato') ?? '');
    } catch {
      // Nombre ilegible: la carpeta queda solo con la clave.
    }

    const almacenamiento = obtenerAlmacenamiento();
    const carpeta = await almacenamiento.obtenerCarpeta(
      claveCarpetaPostulacion(id),
      nombreCarpetaPostulacion(id, candidato),
      { crear: true },
    );
    await almacenamiento.subirArchivo(carpeta, nombreArchivo('cv', req.query.nombre), contenido);

    // No se devuelven ids ni rutas internas al público.
    res.status(201).json({ ok: true, mensaje: 'Currículum recibido.' });
  }),
);

/**
 * GET /api/postulaciones/:id/cv
 * Descarga el CV que el postulante subió desde el portal (carpeta P0001 - Nombre).
 * Lo usan el analista y la jefatura para revisar al postulante antes de decidir.
 */
router.get(
  '/:id/cv',
  autenticar,
  requerirRol('analista', 'jefatura'),
  manejar(async (req, res) => {
    const id = Number(req.params.id);
    if (!obtener(id)) return res.status(404).json({ error: `Postulación #${id} no encontrada.` });

    const almacenamiento = obtenerAlmacenamiento();
    const carpeta = await almacenamiento.obtenerCarpeta(claveCarpetaPostulacion(id), null);
    const cv = carpeta
      ? (await almacenamiento.listarArchivos(carpeta)).find((archivo) => categoriaDeArchivo(archivo.nombre) === 'cv')
      : null;
    if (!cv) return res.status(404).json({ error: 'El postulante no tiene un CV cargado.' });

    const { nombre, tipo, contenido } = await almacenamiento.descargarArchivo(carpeta, cv.id);
    res.set({
      'Content-Type': tipo,
      'Content-Length': contenido.length,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nombre)}`,
    });
    res.send(contenido);
  }),
);

module.exports = router;
