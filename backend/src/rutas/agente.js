const express = require('express');
const { autenticar } = require('../middlewares/auth');
const { limitarPorIp } = require('../middlewares/limite');
const { iaDisponible } = require('../ia/cliente');
const { conContextoUso } = require('../ia/uso');
const { procesarMensaje } = require('../agente');
const { listarAvisos } = require('../agente/herramientas');
const { emitir } = require('../tiempoReal');

/**
 * Marea, el agente de reclutamiento (ver src/agente). Cada herramienta valida el rol del usuario;
 * aquí solo se exige sesión y que la IA esté configurada.
 */
const router = express.Router();
router.use(autenticar);
router.use(conContextoUso);

// Mismo límite por IP que las demás ayudas de IA (rutas/ia.js). Los botones no llaman a la IA,
// pero «Confirmar» y el análisis completo sí pueden escribir o tener costo: cuentan igual.
const limite = limitarPorIp({ maximo: 20, ventanaMs: 10 * 60 * 1000 });

function exigirIa(req, res, next) {
  if (!iaDisponible()) return res.status(503).json({ error: 'La IA no está configurada en el servidor.' });
  return next();
}

/**
 * POST /api/agente/mensaje
 * Cuerpo: { mensaje, foco?, accion? }. Responde { texto, tarjetas, opciones, foco }.
 */
router.post('/mensaje', exigirIa, limite, async (req, res, next) => {
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
