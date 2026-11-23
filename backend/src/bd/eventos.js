/**
 * Historial de la plataforma (tabla eventos): qué pasó, quién lo hizo y cuándo. Lo llaman las rutas
 * después de cada cambio exitoso. Registrar nunca rompe la operación: si falla, solo queda en el log.
 * El detalle es corto y nunca lleva notas clínicas, pauta ni comentarios libres.
 */
const db = require('./conexion');

/** Tipo de evento → cómo se lee en una frase. */
const TIPOS_EVENTO = {
  postulacion_recibida: 'Postulación recibida',
  pasada_a_evaluacion: 'Pasó a evaluación',
  postulacion_descartada: 'Postulación descartada',
  postulacion_reactivada: 'Postulación reactivada',
  perfil_extraido: 'Perfil extraído del CV',
  candidato_registrado: 'Candidato registrado',
  solicitud_creada: 'Solicitud creada',
  solicitud_asignada: 'Solicitud asignada',
  entrevista_agendada: 'Entrevista agendada',
  entrevista_realizada: 'Entrevista realizada',
  entrevista_por_coordinar: 'Entrevista por coordinar',
  informe_enviado: 'Informe enviado',
  evaluacion_registrada: 'Evaluación registrada',
  solicitud_cerrada: 'Solicitud cerrada sin evaluación',
  solicitud_reabierta: 'Solicitud reabierta',
  oferta_publicada: 'Oferta publicada',
  oferta_cerrada: 'Oferta cerrada',
};

const EVENTO_DE_ETAPA = {
  recibida: 'entrevista_por_coordinar',
  agendada: 'entrevista_agendada',
  realizada: 'entrevista_realizada',
  informe: 'informe_enviado',
};

function registrarEvento({ tipo, entidad, entidadId, usuario = '', detalle = '' }) {
  try {
    if (!TIPOS_EVENTO[tipo]) throw new Error(`tipo de evento desconocido: ${tipo}`);
    db.prepare('INSERT INTO eventos (tipo, entidad, entidad_id, usuario, detalle) VALUES (?, ?, ?, ?, ?)').run(
      tipo, entidad, Number(entidadId), String(usuario ?? ''), String(detalle ?? '').slice(0, 200),
    );
  } catch (error) {
    console.error('⚠️ No se pudo registrar el evento:', error.message);
  }
}

/** Nombre y cargo de una solicitud para el detalle del evento. */
function detalleSolicitud(id) {
  const fila = db.prepare('SELECT c.nombre, s.cargo FROM solicitudes s JOIN candidatos c ON c.id = s.candidato_id WHERE s.id = ?').get(Number(id));
  return fila ? `${fila.nombre} · ${fila.cargo}` : '';
}

function registrarEventoSolicitud(tipo, id, usuario, extra = '') {
  registrarEvento({ tipo, entidad: 'solicitud', entidadId: id, usuario, detalle: [detalleSolicitud(id), extra].filter(Boolean).join(' · ') });
}

module.exports = { EVENTO_DE_ETAPA, TIPOS_EVENTO, registrarEvento, registrarEventoSolicitud };
