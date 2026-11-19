const express = require('express');
const { autenticar } = require('../middlewares/auth');
const { procesarMensaje } = require('../agente');
const { listarAvisos } = require('../agente/herramientas');
const { emitir } = require('../tiempoReal');

/**
 * Marea, el agente de reclutamiento (ver src/agente). Cada herramienta valida el rol del usuario;
 * aquí solo se exige sesión. No usa servicios de IA ni claves: funciona siempre que haya backend.
 */
const router = express.Router();
router.use(autenticar);

/**
 * POST /api/agente/mensaje
 * Cuerpo: { mensaje, foco?, accion? }. Responde { texto, tarjetas, opciones, foco }.
 */
router.post('/mensaje', async (req, res, next) => {
  try {
    const { mensaje, foco, accion } = req.body ?? {};
    const { cambioDatos, ...respuesta } = await procesarMensaje({ usuario: req.usuario, mensaje, foco, accion });
    // Agendar desde Marea cambia el Planner: las pantallas abiertas vuelven a traer sus datos.
    if (cambioDatos) emitir('datos', { ruta: req.originalUrl });
    res.json({ ok: true, ...respuesta });
  } catch (error) {
    next(error);
  }
});

/** GET /api/agente/avisos — solicitudes nuevas, asignaciones y postulaciones recientes del usuario. */
router.get('/avisos', (req, res) => {
  res.json({ ok: true, ...listarAvisos(req.usuario) });
});

module.exports = router;
