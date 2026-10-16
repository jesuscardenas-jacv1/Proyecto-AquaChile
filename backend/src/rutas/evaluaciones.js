const express = require('express');
const db = require('../bd/conexion');
const { autenticar, requerirRol } = require('../middlewares/auth');
const { formatearEvaluacion } = require('../formateo');
const {
  ErrorHttp,
  ESTADOS_QUE_PERMITEN_EVALUAR,
  limpiar,
  idValido,
  exigirSinErrores,
  validarEvaluacion,
} = require('../validaciones');

const router = express.Router();

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
  const solicitudId = idValido(req.params.solicitudId, 'id de solicitud');
  const e = db.prepare('SELECT * FROM evaluaciones WHERE solicitud_id = ?').get(solicitudId);

  if (!e) {
    throw new ErrorHttp(404, `No existe evaluación registrada para la solicitud #${solicitudId}.`);
  }

  res.json({ ok: true, evaluacion: formatearEvaluacion(e, req.usuario.rol) });
});

/**
 * POST /api/evaluaciones
 * Registrar una nueva evaluación psicolaboral (exclusivo para Evaluadores)
 * Al registrar la evaluación, la solicitud pasa automáticamente a estado 'Finalizada'.
 */
router.post('/', autenticar, requerirRol('evaluador'), (req, res) => {
  const datos = req.body ?? {};
  const solicitudId = idValido(datos.solicitudId, 'id de solicitud');
  exigirSinErrores(validarEvaluacion(datos));

  const solicitud = db.prepare('SELECT * FROM solicitudes WHERE id = ?').get(solicitudId);
  if (!solicitud) {
    throw new ErrorHttp(404, `La solicitud #${solicitudId} no existe.`);
  }

  // Misma regla que el frontend: no se evalúa una solicitud que sigue Pendiente
  if (!ESTADOS_QUE_PERMITEN_EVALUAR.includes(solicitud.estado)) {
    throw new ErrorHttp(
      409,
      `La solicitud #${solicitudId} está "${solicitud.estado}": debe estar En proceso para evaluarla.`,
    );
  }

  const existente = db.prepare('SELECT id FROM evaluaciones WHERE solicitud_id = ?').get(solicitudId);
  if (existente) {
    throw new ErrorHttp(
      409,
      `La solicitud #${solicitudId} ya tiene una evaluación registrada. Utilice PUT para actualizarla.`,
    );
  }

  const fechaHoy = new Date().toISOString().split('T')[0];
  const fechaEval = limpiar(datos.fechaEvaluacion) || fechaHoy;

  if (fechaEval < solicitud.fecha_solicitud) {
    throw new ErrorHttp(400, 'La fecha de evaluación no puede ser anterior a la fecha de solicitud.', {
      fechaEvaluacion: 'Debe ser igual o posterior a la fecha de solicitud.',
    });
  }

  // Días corridos entre la solicitud y el informe (mínimo 1). Misma regla que
  // calcularDiasRespuesta del frontend y el script de importación.
  const diasRespuesta = Math.max(
    1,
    Math.round((new Date(fechaEval) - new Date(solicitud.fecha_solicitud)) / (1000 * 60 * 60 * 24)),
  );

  db.exec('BEGIN TRANSACTION;');

  let idNueva;
  try {
    const resEval = db
      .prepare(
        `INSERT INTO evaluaciones (
          solicitud_id, fecha_evaluacion, resultado, observaciones,
          estado, fecha_informe, dias_respuesta
        ) VALUES (?, ?, ?, ?, 'Realizada', ?, ?)`,
      )
      .run(solicitudId, fechaEval, datos.resultado, limpiar(datos.observaciones), fechaEval, diasRespuesta);
    idNueva = resEval.lastInsertRowid;

    // Actualizar la solicitud a 'Finalizada'
    db.prepare(
      `UPDATE solicitudes
       SET estado = 'Finalizada', etapa = 'informe', actualizado_en = datetime('now')
       WHERE id = ?`,
    ).run(solicitudId);

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }

  const nueva = db.prepare('SELECT * FROM evaluaciones WHERE id = ?').get(idNueva);
  res.status(201).json({
    ok: true,
    mensaje: 'Evaluación registrada exitosamente y solicitud finalizada.',
    evaluacion: formatearEvaluacion(nueva, req.usuario.rol),
  });
});

/**
 * PUT /api/evaluaciones/:id
 * Actualizar una evaluación existente (exclusivo para Evaluadores).
 * Solo se modifican los campos enviados, que se validan igual que al crear.
 */
router.put('/:id', autenticar, requerirRol('evaluador'), (req, res) => {
  const id = idValido(req.params.id);
  const cambios = req.body ?? {};

  const actual = db.prepare('SELECT * FROM evaluaciones WHERE id = ?').get(id);
  if (!actual) {
    throw new ErrorHttp(404, `Evaluación #${id} no encontrada.`);
  }

  exigirSinErrores(validarEvaluacion(cambios, { parcial: true }));

  db.prepare(
    `UPDATE evaluaciones
     SET resultado = COALESCE(?, resultado),
         observaciones = COALESCE(?, observaciones),
         fecha_evaluacion = COALESCE(?, fecha_evaluacion),
         actualizado_en = datetime('now')
     WHERE id = ?`,
  ).run(
    cambios.resultado ?? null,
    cambios.observaciones === undefined ? null : limpiar(cambios.observaciones),
    limpiar(cambios.fechaEvaluacion) || null,
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
