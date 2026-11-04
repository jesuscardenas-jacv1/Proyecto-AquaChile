const db = require('./conexion');
const { emitir } = require('../tiempoReal');

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
    destinatarios.forEach(({ id }) => {
      const { lastInsertRowid } = insertar(id, aviso);
      // Se avisa al instante a la pantalla abierta de ese usuario (si la hay).
      emitir(
        'notificacion',
        {
          id: Number(lastInsertRowid),
          tipo: aviso.tipo,
          mensaje: aviso.mensaje,
          enlace: aviso.enlace ?? '',
          leida: false,
          creadaEn: new Date().toISOString(),
        },
        [id],
      );
    });
  } catch (error) {
    console.error('No se pudo crear la notificación:', error.message);
  }
}

const usuariosConRol = (rol) => db.prepare('SELECT id FROM usuarios WHERE rol = ?').all(rol);

/** Avisa a todos los usuarios de un rol (p. ej. a los analistas), salvo a `excepto` (quien hizo el cambio). */
function notificarRol(rol, aviso, excepto = null) {
  notificar(
    usuariosConRol(rol).filter(({ id }) => id !== excepto),
    aviso,
  );
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

module.exports = { notificar, notificarRol, notificarPsicologa, resumenSolicitud };
