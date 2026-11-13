const express = require('express');
const db = require('../bd/conexion');
const { autenticar, requerirRol } = require('../middlewares/auth');

/**
 * Panel de entrevista de la psicóloga (/planner/entrevista/:id en el frontend).
 *
 * - GET: lo guardado de la entrevista (notas, transcripción en vivo, preguntas ya hechas y
 *   nombres de los hablantes) y el análisis del CV que hizo el analista con IA, si existe.
 * - PUT: guardado automático mientras transcurre la entrevista.
 *
 * Es información confidencial: solo la ven la psicóloga evaluadora y el administrador.
 * El cierre (pauta y notas por competencia con IA) está en POST /api/ia/solicitudes/:id/entrevista/cierre.
 */
const router = express.Router();
router.use(autenticar, requerirRol('evaluador'));

const LIMITES = {
  notas: 20000,
  segmentos: 3000,
  textoSegmento: 3000,
  transcripcion: 150000,
  preguntas: 40,
  textoPregunta: 600,
  hablantes: 10,
  segundos: 4 * 60 * 60,
};
const ROLES_HABLANTE = ['', 'Psicóloga', 'Postulante'];

class ErrorEntrevista extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.status = status;
  }
}

const leerJson = (valor, porDefecto) => {
  try {
    return JSON.parse(valor);
  } catch {
    return porDefecto;
  }
};

const formatear = (fila, solicitudId) => ({
  solicitudId,
  notas: fila?.notas ?? '',
  transcripcion: leerJson(fila?.transcripcion ?? '[]', []),
  preguntas: leerJson(fila?.preguntas ?? '[]', []),
  hablantes: leerJson(fila?.hablantes ?? '{}', {}),
  segundosAudio: fila?.segundos_audio ?? 0,
  actualizadoPor: fila?.actualizado_por ?? '',
  actualizadoEn: fila?.actualizado_en ?? null,
});

function solicitudAbierta(id) {
  const solicitud = db.prepare('SELECT id, motivo_cierre FROM solicitudes WHERE id = ?').get(id);
  if (!solicitud) throw new ErrorEntrevista(`Solicitud #${id} no encontrada.`, 404);
  return solicitud;
}

/** Valida y normaliza lo que envía el panel. Lanza ErrorEntrevista con un mensaje claro. */
function validar(cuerpo = {}) {
  const notas = typeof cuerpo.notas === 'string' ? cuerpo.notas : '';
  if (notas.length > LIMITES.notas) throw new ErrorEntrevista('Las notas superan los 20.000 caracteres.', 413);

  const segmentos = Array.isArray(cuerpo.transcripcion) ? cuerpo.transcripcion : [];
  if (segmentos.length > LIMITES.segmentos) throw new ErrorEntrevista('La transcripción es demasiado larga.', 413);
  const transcripcion = segmentos
    .map((segmento) => ({
      hablante: String(segmento?.hablante ?? '').slice(0, 40),
      inicioMs: Math.max(0, Math.round(Number(segmento?.inicioMs) || 0)),
      texto: String(segmento?.texto ?? '').trim().slice(0, LIMITES.textoSegmento),
    }))
    .filter((segmento) => segmento.texto);
  if (transcripcion.reduce((total, segmento) => total + segmento.texto.length, 0) > LIMITES.transcripcion) {
    throw new ErrorEntrevista('La transcripción supera los 150.000 caracteres.', 413);
  }

  const preguntas = (Array.isArray(cuerpo.preguntas) ? cuerpo.preguntas : [])
    .filter((pregunta) => typeof pregunta === 'string' && pregunta.trim())
    .slice(0, LIMITES.preguntas)
    .map((pregunta) => pregunta.trim().slice(0, LIMITES.textoPregunta));

  const hablantes = Object.fromEntries(
    Object.entries(cuerpo.hablantes && typeof cuerpo.hablantes === 'object' ? cuerpo.hablantes : {})
      .slice(0, LIMITES.hablantes)
      .filter(([, rol]) => ROLES_HABLANTE.includes(rol))
      .map(([id, rol]) => [String(id).slice(0, 40), rol]),
  );

  const segundosAudio = Math.min(Math.max(Number(cuerpo.segundosAudio) || 0, 0), LIMITES.segundos);
  return { notas, transcripcion, preguntas, hablantes, segundosAudio };
}

/** Análisis del CV de la postulación que dio origen a la solicitud (o null). */
function analisisDeSolicitud(solicitudId) {
  const fila = db
    .prepare(
      `SELECT a.*, o.titulo AS oferta FROM postulaciones p
       JOIN analisis_cv a ON a.postulacion_id = p.id
       LEFT JOIN ofertas o ON o.id = p.oferta_id
       WHERE p.solicitud_id = ?
       ORDER BY a.creado_en DESC LIMIT 1`,
    )
    .get(solicitudId);
  if (!fila) return null;
  return {
    postulacionId: fila.postulacion_id,
    oferta: fila.oferta ?? '',
    resultado: leerJson(fila.resultado, null),
    creadoPor: fila.creado_por,
    creadoEn: fila.creado_en,
  };
}

/** GET /api/entrevistas/:solicitudId */
router.get('/:solicitudId', (req, res, next) => {
  try {
    const id = Number(req.params.solicitudId);
    solicitudAbierta(id);
    const fila = db.prepare('SELECT * FROM entrevistas WHERE solicitud_id = ?').get(id);
    const tienePostulacion = Boolean(db.prepare('SELECT id FROM postulaciones WHERE solicitud_id = ?').get(id));
    res.json({ ok: true, entrevista: formatear(fila, id), analisis: analisisDeSolicitud(id), tienePostulacion });
  } catch (error) {
    next(error);
  }
});

/** PUT /api/entrevistas/:solicitudId — guardado automático del panel. */
router.put('/:solicitudId', (req, res, next) => {
  try {
    const id = Number(req.params.solicitudId);
    const solicitud = solicitudAbierta(id);
    if (solicitud.motivo_cierre) throw new ErrorEntrevista('La solicitud se cerró sin evaluación.', 409);
    const datos = validar(req.body);
    db.prepare(
      `INSERT INTO entrevistas (solicitud_id, notas, transcripcion, preguntas, hablantes, segundos_audio, actualizado_por, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(solicitud_id) DO UPDATE SET
         notas = excluded.notas, transcripcion = excluded.transcripcion, preguntas = excluded.preguntas,
         hablantes = excluded.hablantes, segundos_audio = excluded.segundos_audio,
         actualizado_por = excluded.actualizado_por, actualizado_en = excluded.actualizado_en`,
    ).run(
      id,
      datos.notas,
      JSON.stringify(datos.transcripcion),
      JSON.stringify(datos.preguntas),
      JSON.stringify(datos.hablantes),
      datos.segundosAudio,
      req.usuario.nombre ?? '',
    );
    const fila = db.prepare('SELECT * FROM entrevistas WHERE solicitud_id = ?').get(id);
    res.json({ ok: true, entrevista: formatear(fila, id) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
module.exports.validar = validar;
