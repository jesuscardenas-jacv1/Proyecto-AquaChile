/**
 * Canal en tiempo real (Server-Sent Events) entre el servidor y las pantallas abiertas.
 *
 * Cada navegador con sesión mantiene una conexión abierta a `GET /api/eventos`. Por ella
 * llegan dos tipos de evento:
 * - `notificacion`: un aviso nuevo para ese usuario (campana y aviso en pantalla).
 * - `datos`: alguien cambió información; las pantallas vuelven a traer sus listas.
 *
 * Es en memoria: sirve para un único proceso (como el plan B1 de Azure App Service).
 * Si hubiera varias instancias, cada una avisaría solo a sus propias conexiones.
 */

const INTERVALO_LATIDO_MS = 25000;
const conexiones = new Set();

/** Escribe un evento SSE en una conexión; si la conexión ya no existe, la descarta. */
function escribir(conexion, evento, datos) {
  try {
    conexion.res.write(`event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`);
  } catch {
    conexiones.delete(conexion);
  }
}

/**
 * Registra una conexión de un usuario con sesión.
 * @returns {Function} cancela la conexión (se llama al cerrar el navegador o la pestaña).
 */
function conectar(usuarioId, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  const conexion = { usuarioId, res };
  conexiones.add(conexion);
  escribir(conexion, 'conectado', { ok: true });
  return () => conexiones.delete(conexion);
}

/**
 * Envía un evento a los destinatarios indicados (ids de usuario) o a todos si no se indica.
 */
function emitir(evento, datos, destinatarios = null) {
  const ids = destinatarios ? new Set(destinatarios) : null;
  conexiones.forEach((conexion) => {
    if (!ids || ids.has(conexion.usuarioId)) escribir(conexion, evento, datos);
  });
}

/** Cantidad de conexiones abiertas (para pruebas y diagnóstico). */
const cantidadConexiones = () => conexiones.size;

// Latido para que los proxies (Azure) no cierren conexiones inactivas.
const latido = setInterval(() => {
  conexiones.forEach((conexion) => {
    try {
      conexion.res.write(': latido\n\n');
    } catch {
      conexiones.delete(conexion);
    }
  });
}, INTERVALO_LATIDO_MS);
latido.unref();

module.exports = { conectar, emitir, cantidadConexiones };
