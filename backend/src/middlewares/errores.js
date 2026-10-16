/**
 * Middleware para rutas no encontradas (404)
 */
function rutaNoEncontrada(req, res) {
  res.status(404).json({
    error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  });
}

/**
 * Manejador global de excepciones no controladas (500)
 */
function manejadorErrores(err, req, res, next) {
  const status = err.status || 500;
  // Los 4xx son errores esperados del cliente (validaciones, permisos); no ensucian el log.
  if (status >= 500) {
    console.error('❌ Error no controlado en el servidor:', err);
  }

  res.status(status).json({
    error: err.message || 'Error interno del servidor.',
    ...(process.env.NODE_ENV !== 'production' && { detalle: err.stack }),
  });
}

module.exports = {
  rutaNoEncontrada,
  manejadorErrores,
};
