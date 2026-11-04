const db = require('./conexion');

const insertar = (usuarioId, { tipo, mensaje, enlace }) =>
  db
    .prepare('INSERT INTO notificaciones (usuario_id, tipo, mensaje, enlace) VALUES (?, ?, ?, ?)')
    .run(usuarioId, tipo, mensaje, enlace);

/**
 * Crea el aviso para cada destinatario. Un aviso que falla no debe hacer fallar la
 * operación que lo originó (la postulación o la solicitud ya quedaron guardadas).
 */
function notificar(destinatarios, aviso) {
  try {
    destinatarios.forEach(({ id }) => insertar(id, aviso));
  } catch (error) {
    console.error('No se pudo crear la notificación:', error.message);
  }
}

const usuariosConRol = (rol) => db.prepare('SELECT id FROM usuarios WHERE rol = ?').all(rol);

/** Avisa a todos los usuarios de un rol (p. ej. a los analistas). */
function notificarRol(rol, aviso) {
  notificar(usuariosConRol(rol), aviso);
}

/** Avisa a la psicóloga responsable, que se guarda por nombre en la solicitud. */
function notificarPsicologa(nombre, aviso) {
  notificar(db.prepare("SELECT id FROM usuarios WHERE rol = 'evaluador' AND nombre = ?").all(nombre), aviso);
}

/** Texto común de los avisos de solicitud: "#12 · Ana Pérez · Operario". */
function resumenSolicitud(solicitud) {
  const candidato = db.prepare('SELECT nombre FROM candidatos WHERE id = ?').get(solicitud.candidato_id);
  return `#${solicitud.id} · ${candidato?.nombre ?? 'Candidato'} · ${solicitud.cargo}`;
}

module.exports = { notificarRol, notificarPsicologa, resumenSolicitud };
