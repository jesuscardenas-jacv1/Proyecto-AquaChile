const express = require('express');
const { obtenerAlmacenamiento } = require('../almacenamiento');
const {
  ErrorAlmacenamiento,
  TAMANO_MAXIMO_CV_PORTAL,
  claveCarpetaPostulacion,
  nombreArchivo,
  nombreCarpetaPostulacion,
  validarCvPortal,
} = require('../almacenamiento/comun');
const { limitarPorIp } = require('../middlewares/limite');

/**
 * Rutas públicas del portal "Trabaja con nosotros" (sin sesión).
 * El CV queda en una carpeta de postulación (P0001 - Nombre) hasta que el analista
 * la pasa a evaluación; ahí se copia a la carpeta de la solicitud.
 */
const router = express.Router();

const leerArchivo = express.raw({ type: () => true, limit: TAMANO_MAXIMO_CV_PORTAL + 1024 });
const limite = limitarPorIp({ maximo: 10, ventanaMs: 10 * 60 * 1000 });
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

module.exports = router;
