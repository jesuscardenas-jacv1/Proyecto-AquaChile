const db = require('./conexion');
const { emitir } = require('../tiempoReal');
const { enviarEnSegundoPlano } = require('../correo');

const insertar = (usuarioId, { tipo, mensaje, enlace }) =>
  db
    .prepare('INSERT INTO notificaciones (usuario_id, tipo, mensaje, enlace) VALUES (?, ?, ?, ?)')
    .run(usuarioId, tipo, mensaje, enlace);

/**
 * Crea el aviso para cada destinatario. Un aviso que falla no debe hacer fallar la
 * operación que lo originó (la postulación o la solicitud ya quedaron guardadas).
 *
 * `opciones.correo(destinatario)` (opcional) arma `{ asunto, html, texto }`: además del aviso en
 * la campana se envía ese correo con Resend, en segundo plano. Solo lo usan la solicitud
 * nueva y la asignación.
 */
function notificar(destinatarios, aviso, opciones = {}) {
  try {
    destinatarios.forEach((destinatario) => {
      const { id } = destinatario;
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
      if (opciones.correo && destinatario.correo) {
        enviarEnSegundoPlano({ para: destinatario.correo, ...opciones.correo(destinatario) });
      }
    });
  } catch (error) {
    console.error('No se pudo crear la notificación:', error.message);
  }
}

const usuariosConRol = (rol) => db.prepare('SELECT id, nombre, correo FROM usuarios WHERE rol = ?').all(rol);

/** Avisa a todos los usuarios de un rol (p. ej. a los analistas), salvo a `excepto` (quien hizo el cambio). */
function notificarRol(rol, aviso, excepto = null, opciones = {}) {
  notificar(
    usuariosConRol(rol).filter(({ id }) => id !== excepto),
    aviso,
    opciones,
  );
}

/** Avisa a la psicóloga responsable, que se guarda por nombre en la solicitud. */
function notificarPsicologa(nombre, aviso, opciones = {}) {
  notificar(
    db.prepare("SELECT id, nombre, correo FROM usuarios WHERE rol = 'evaluador' AND nombre = ?").all(nombre),
    aviso,
    opciones,
  );
}

/** Texto común de los avisos de solicitud: "#12 · Ana Pérez · Operario". */
function resumenSolicitud(solicitud) {
  const { id, candidato, cargo } = datosCorreoSolicitud(solicitud);
  return `#${id} · ${candidato} · ${cargo}`;
}

/** Datos de la solicitud que van en el correo: número, candidato y cargo (nada clínico). */
function datosCorreoSolicitud(solicitud) {
  const candidato = db.prepare('SELECT nombre FROM candidatos WHERE id = ?').get(solicitud.candidato_id);
  return { id: solicitud.id, candidato: candidato?.nombre ?? 'Candidato', cargo: solicitud.cargo };
}

module.exports = { datosCorreoSolicitud, notificar, notificarRol, notificarPsicologa, resumenSolicitud };
