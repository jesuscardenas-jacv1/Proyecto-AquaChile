const express = require('express');
const { autenticar, requerirRol } = require('../middlewares/auth');
const { sembrar } = require('../bd/semilla');

/** Herramientas del Administrador académico. */
const router = express.Router();

/**
 * POST /api/admin/reiniciar
 * Restablece la base de datos con los datos de demostración (solo admin:
 * requerirRol sin roles deja pasar únicamente al administrador).
 */
router.post('/reiniciar', autenticar, requerirRol(), async (req, res, next) => {
  try {
    const totales = await sembrar({ silencioso: true });
    res.json({ ok: true, mensaje: 'Datos de demostración restablecidos.', totales });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
