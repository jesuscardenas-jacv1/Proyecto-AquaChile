const express = require('express');
const { autenticar } = require('../middlewares/auth');
const { conectar } = require('../tiempoReal');

/** Canal en tiempo real del usuario con sesión (ver tiempoReal.js). */
const router = express.Router();

/** GET /api/eventos — se mantiene abierta; el navegador recibe avisos y cambios al instante. */
router.get('/', autenticar, (req, res) => {
  const cancelar = conectar(req.usuario.id, res);
  req.on('close', cancelar);
});

module.exports = router;
