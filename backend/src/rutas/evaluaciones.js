const express = require('express');
const db = require('../bd/conexion');
const { autenticar, requerirRol, puedeVerNotasClinicas } = require('../middlewares/auth');

const router = express.Router();

function formatearEvaluacion(e, rolUsuario) {
  const confidencial = !puedeVerNotasClinicas(rolUsuario);

  return {
    id: e.id,
    solicitudId: e.solicitud_id,
    fechaEvaluacion: e.fecha_evaluacion,
    resultado: e.resultado,
    estado: e.estado,
    fechaInforme: e.fecha_informe,
    diasRespuesta: e.dias_respuesta,
    // Ocultar observaciones clínicas cualitativas al analista y a la jefatura
    observaciones: confidencial ? undefined : e.observaciones,
    confidencial,
    creadoEn: e.creado_en,
  };
}

/**
 * GET /api/evaluaciones
 * Listado de todas las evaluaciones registradas
 */
router.get('/', autenticar, (req, res) => {
  const rows = db.prepare('SELECT * FROM evaluaciones ORDER BY id DESC').all();
  const evaluaciones = rows.map((e) => formatearEvaluacion(e, req.usuario.rol));

  res.json({ ok: true, total: evaluaciones.length, evaluaciones });
});

/**
 * GET /api/evaluaciones/solicitud/:solicitudId
 * Obtener la evaluación asociada a una solicitud específica
 */
router.get('/solicitud/:solicitudId', autenticar, (req, res) => {
  const solicitudId = parseInt(req.params.solicitudId, 10);
  const e = db.prepare('SELECT * FROM evaluaciones WHERE solicitud_id = ?').get(solicitudId);

  if (!e) {
    return res.status(404).json({
      error: `No existe evaluación registrada para la solicitud #${solicitudId}.`,
    });
  }

  res.json({ ok: true, evaluacion: formatearEvaluacion(e, req.usuario.rol) });
});

/**
 * POST /api/evaluaciones
 * Registrar una nueva evaluación psicolaboral (exclusivo para Evaluadores)
 * Al registrar la evaluación, la solicitud pasa automáticamente a estado 'Finalizada'.
 */
router.post('/', autenticar, requerirRol('evaluador'), (req, res) => {
  const { solicitudId, fechaEvaluacion, resultado, observaciones } = req.body;

  if (!solicitudId || !resultado || !observaciones) {
    return res.status(400).json({
      error: 'Debe especificar la solicitud, el resultado del dictamen y las observaciones clínicas.',
    });
  }

  const resultadosValidos = ['Recomendado', 'Recomendado con observaciones', 'No recomendado'];
  if (!resultadosValidos.includes(resultado)) {
    return res.status(400).json({
      error: `Resultado inválido. Opciones permitidas: ${resultadosValidos.join(', ')}.`,
    });
  }

  // Verificar que la solicitud exista y esté 'En proceso'
  const solicitud = db.prepare('SELECT * FROM solicitudes WHERE id = ?').get(solicitudId);
  if (!solicitud) {
    return res.status(404).json({ error: `La solicitud #${solicitudId} no existe.` });
  }

  const existente = db.prepare('SELECT id FROM evaluaciones WHERE solicitud_id = ?').get(solicitudId);
  if (existente) {
    return res.status(409).json({
      error: `La solicitud #${solicitudId} ya tiene una evaluación registrada. Utilice PUT para actualizarla.`,
    });
  }

  const fechaHoy = new Date().toISOString().split('T')[0];
  const fechaEval = fechaEvaluacion || fechaHoy;

  // Calcular días de respuesta hábiles o aproximados
  const diasRespuesta = Math.max(
    1,
    Math.round((new Date(fechaEval) - new Date(solicitud.fecha_solicitud)) / (1000 * 60 * 60 * 24)),
  );

  db.exec('BEGIN TRANSACTION;');

  try {
    const stmt = db.prepare(`
      INSERT INTO evaluaciones (
        solicitud_id, fecha_evaluacion, resultado, observaciones,
        estado, fecha_informe, dias_respuesta
      ) VALUES (?, ?, ?, ?, 'Realizada', ?, ?)
    `);

    const resEval = stmt.run(
      solicitudId,
      fechaEval,
      resultado,
      observaciones.trim(),
      fechaEval,
      diasRespuesta,
    );

    // Actualizar la solicitud a 'Finalizada'
    db.prepare(`
      UPDATE solicitudes
      SET estado = 'Finalizada',
          actualizado_en = datetime('now')
      WHERE id = ?
    `).run(solicitudId);

    db.exec('COMMIT;');

    const nueva = db.prepare('SELECT * FROM evaluaciones WHERE id = ?').get(resEval.lastInsertRowid);

    res.status(201).json({
      ok: true,
      mensaje: 'Evaluación registrada exitosamente y solicitud finalizada.',
      evaluacion: formatearEvaluacion(nueva, req.usuario.rol),
    });
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
});

/**
 * PUT /api/evaluaciones/:id
 * Actualizar una evaluación existente (exclusivo para Evaluadores)
 */
router.put('/:id', autenticar, requerirRol('evaluador'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { resultado, observaciones, fechaEvaluacion } = req.body;

  const actual = db.prepare('SELECT * FROM evaluaciones WHERE id = ?').get(id);
  if (!actual) {
    return res.status(404).json({ error: `Evaluación #${id} no encontrada.` });
  }

  db.prepare(`
    UPDATE evaluaciones
    SET resultado = COALESCE(?, resultado),
        observaciones = COALESCE(?, observaciones),
        fecha_evaluacion = COALESCE(?, fecha_evaluacion),
        actualizado_en = datetime('now')
    WHERE id = ?
  `).run(
    resultado || null,
    observaciones ? observaciones.trim() : null,
    fechaEvaluacion || null,
    id,
  );

  const modificado = db.prepare('SELECT * FROM evaluaciones WHERE id = ?').get(id);

  res.json({
    ok: true,
    mensaje: 'Evaluación actualizada con éxito.',
    evaluacion: formatearEvaluacion(modificado, req.usuario.rol),
  });
});

module.exports = router;
