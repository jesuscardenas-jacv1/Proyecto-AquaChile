/**
 * Límite simple de solicitudes por IP, en memoria. Protege las rutas públicas
 * (portal de postulación) de envíos masivos. Al reiniciar el servidor se reinicia.
 */
function limitarPorIp({ maximo, ventanaMs }) {
  const registros = new Map();

  return (req, res, next) => {
    const ahora = Date.now();
    const ip = req.ip || req.socket?.remoteAddress || 'desconocida';
    const recientes = (registros.get(ip) ?? []).filter((momento) => ahora - momento < ventanaMs);

    if (recientes.length >= maximo) {
      return res.status(429).json({ error: 'Demasiadas solicitudes. Intente nuevamente en unos minutos.' });
    }

    recientes.push(ahora);
    registros.set(ip, recientes);
    return next();
  };
}

module.exports = { limitarPorIp };
