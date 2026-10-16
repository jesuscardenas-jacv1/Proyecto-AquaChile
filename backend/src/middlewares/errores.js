/**
 * Middleware para rutas no encontradas (404)
 */
function rutaNoEncontrada(req, res) {
  res.status(404).json({
    error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
}

/**
 * Manejador global de excepciones.
 * - Errores con `status` (ErrorHttp, JSON mal formado de express.json) se devuelven tal cual.
 * - Restricciones de SQLite (CHECK, UNIQUE, FOREIGN KEY) se responden como 400/409.
 * - Cualquier otro error es un 500 con mensaje genérico: el detalle y el stack
 *   solo se registran en el servidor, nunca se envían al cliente.
 */
function manejadorErrores(err, req, res, next) {
  if (res.headersSent) return next(err);

  // JSON mal formado en el cuerpo de la petición
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido.' });
  }

  if (err.status && err.status < 500) {
    return res.status(err.status).json({
      error: err.message,
      ...(err.errores && { errores: err.errores }),
    });
  }

  const mensaje = String(err.message || '');
  if (/UNIQUE constraint failed/i.test(mensaje)) {
    return res.status(409).json({ error: 'El registro ya existe.' });
  }
  if (/(CHECK|FOREIGN KEY|NOT NULL) constraint failed/i.test(mensaje)) {
    return res.status(400).json({ error: 'Los datos enviados no cumplen las reglas de la base de datos.' });
  }

  console.error('❌ Error no controlado en el servidor:', err);
  return res.status(500).json({ error: 'Error interno del servidor.' });
}

module.exports = {
  rutaNoEncontrada,
  manejadorErrores,
};
