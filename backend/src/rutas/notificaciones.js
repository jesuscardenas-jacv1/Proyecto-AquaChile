const express = require('express');
const db = require('../bd/conexion');
const { autenticar } = require('../middlewares/auth');

/** Notificaciones del usuario con sesión: cada uno ve y marca solo las suyas. */
const router = express.Router();
router.use(autenticar);

const MAXIMO_LISTADO = 30;

const formatear = (n) => ({
  id: n.id,
  tipo: n.tipo,
  mensaje: n.mensaje,
  enlace: n.enlace,
  leida: Boolean(n.leida),
  creadaEn: n.creado_en,
});

/**
 * GET /api/notificaciones
 * Las más recientes y el total sin leer.
 */
router.get('/', (req, res) => {
  const notificaciones = db
    .prepare('SELECT * FROM notificaciones WHERE usuario_id = ? ORDER BY id DESC LIMIT ?')
    .all(req.usuario.id, MAXIMO_LISTADO)
    .map(formatear);
  const { total } = db
    .prepare('SELECT COUNT(*) AS total FROM notificaciones WHERE usuario_id = ? AND leida = 0')
    .get(req.usuario.id);
  res.json({ ok: true, noLeidas: total, notificaciones });
});

/**
 * POST /api/notificaciones/leidas
 * Marca todas como leídas.
 */
router.post('/leidas', (req, res) => {
  db.prepare('UPDATE notificaciones SET leida = 1 WHERE usuario_id = ? AND leida = 0').run(req.usuario.id);
  res.json({ ok: true });
});

/**
 * PATCH /api/notificaciones/:id/leida
 * Marca una como leída; la de otro usuario se responde como inexistente.
 */
router.patch('/:id/leida', (req, res) => {
  const { changes } = db
    .prepare('UPDATE notificaciones SET leida = 1 WHERE id = ? AND usuario_id = ?')
    .run(Number(req.params.id), req.usuario.id);
  if (!changes) return res.status(404).json({ error: 'Notificación no encontrada.' });
  res.json({ ok: true });
});

module.exports = router;
