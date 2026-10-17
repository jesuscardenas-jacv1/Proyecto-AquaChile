const express = require('express');
const db = require('../bd/conexion');
const { formatearOferta } = require('../bd/formatos');

/**
 * Ofertas del portal "Trabaja con nosotros". Lectura pública (sin sesión):
 * solo se publican las ofertas abiertas.
 */
const router = express.Router();

/** GET /api/ofertas — ofertas abiertas, las más recientes primero. */
router.get('/', (req, res) => {
  const ofertas = db
    .prepare("SELECT * FROM ofertas WHERE estado = 'Abierta' ORDER BY fecha_publicacion DESC, id DESC")
    .all()
    .map(formatearOferta);
  res.json({ ok: true, total: ofertas.length, ofertas });
});

/** GET /api/ofertas/:id — detalle de una oferta abierta. */
router.get('/:id', (req, res) => {
  const oferta = db.prepare("SELECT * FROM ofertas WHERE id = ? AND estado = 'Abierta'").get(Number(req.params.id));
  if (!oferta) {
    return res.status(404).json({ error: 'La oferta no existe o ya cerró su proceso de postulación.' });
  }
  res.json({ ok: true, oferta: formatearOferta(oferta) });
});

module.exports = router;
