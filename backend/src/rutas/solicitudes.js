const express = require('express');
const db = require('../bd/conexion');
const { autenticar, requerirRol, puedeVerNotasClinicas } = require('../middlewares/auth');

const router = express.Router();

function formatearSolicitud(s) {
  return {
    id: s.id,
    candidatoId: s.candidato_id,
    candidatoNombre: s.candidato_nombre,
    cargo: s.cargo,
    familiaCargo: s.familia_cargo,
    fechaSolicitud: s.fecha_solicitud,
    estado: s.estado,
    profesionalResponsable: s.profesional_responsable,
    observaciones: s.observaciones,
    tipoEvaluacion: s.tipo_evaluacion,
    ubicacion: s.ubicacion,
    unidad: s.unidad,
    ceco: s.ceco,
    requiereReferencias: Boolean(s.requiere_referencias),
    referido: Boolean(s.referido),
    cv: s.cv,
    descriptorCargo: s.descriptor_cargo,
    creadoEn: s.creado_en,
  };
}

/**
 * GET /api/solicitudes
 * Listado de solicitudes con filtros opcionales de estado, tipo y búsqueda
 */
router.get('/', autenticar, (req, res) => {
  const { estado, tipoEvaluacion, busqueda } = req.query;

  let query = `
    SELECT s.*, c.nombre as candidato_nombre
    FROM solicitudes s
    LEFT JOIN candidatos c ON s.candidato_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (estado && estado.trim()) {
    query += ' AND s.estado = ?';
    params.push(estado.trim());
  }

  if (tipoEvaluacion && tipoEvaluacion.trim()) {
    query += ' AND s.tipo_evaluacion = ?';
    params.push(tipoEvaluacion.trim());
  }

  if (busqueda && busqueda.trim()) {
    query += ' AND (c.nombre LIKE ? OR s.cargo LIKE ? OR s.profesional_responsable LIKE ?)';
    const term = `%${busqueda.trim()}%`;
    params.push(term, term, term);
  }

  query += ' ORDER BY s.id DESC';

  const rows = db.prepare(query).all(...params);
  const solicitudes = rows.map(formatearSolicitud);

  res.json({ ok: true, total: solicitudes.length, solicitudes });
});

/**
 * GET /api/solicitudes/:id
 * Detalle completo de una solicitud, su candidato y su evaluación asociada
 */
router.get('/:id', autenticar, (req, res) => {
  const id = parseInt(req.params.id, 10);

  const s = db
    .prepare(
      `SELECT s.*, c.nombre as candidato_nombre
       FROM solicitudes s
       LEFT JOIN candidatos c ON s.candidato_id = c.id
       WHERE s.id = ?`,
    )
    .get(id);

  if (!s) {
    return res.status(404).json({ error: `Solicitud #${id} no encontrada.` });
  }

  const candidato = db.prepare('SELECT * FROM candidatos WHERE id = ?').get(s.candidato_id);
  const evaluacion = db.prepare('SELECT * FROM evaluaciones WHERE solicitud_id = ?').get(id);

  // Filtrado de confidencialidad médica/psicológica para analistas y jefatura
  let evaluacionSanitizada = null;
  if (evaluacion) {
    evaluacionSanitizada = {
      id: evaluacion.id,
      solicitudId: evaluacion.solicitud_id,
      fechaEvaluacion: evaluacion.fecha_evaluacion,
      resultado: evaluacion.resultado,
      estado: evaluacion.estado,
      fechaInforme: evaluacion.fecha_informe,
      diasRespuesta: evaluacion.dias_respuesta,
      // Analista y jefatura no ven las observaciones clínicas
      observaciones: puedeVerNotasClinicas(req.usuario.rol) ? evaluacion.observaciones : undefined,
      confidencial: !puedeVerNotasClinicas(req.usuario.rol),
    };
  }

  res.json({
    ok: true,
    solicitud: formatearSolicitud(s),
    candidato: candidato
      ? {
          id: candidato.id,
          nombre: candidato.nombre,
          correo: candidato.correo,
          telefono: candidato.telefono,
          cargo: candidato.cargo,
          familiaCargo: candidato.familia_cargo,
          origen: candidato.origen,
        }
      : null,
    evaluacion: evaluacionSanitizada,
  });
});

/**
 * POST /api/solicitudes
 * Crear una nueva solicitud de evaluación (exclusivo para Analistas)
 */
router.post('/', autenticar, requerirRol('analista'), (req, res) => {
  const {
    candidatoId,
    cargo,
    familiaCargo,
    fechaSolicitud,
    tipoEvaluacion,
    ubicacion,
    unidad,
    ceco,
    requiereReferencias,
    referido,
    cv,
    descriptorCargo,
    observaciones,
    profesionalResponsable,
  } = req.body;

  if (!candidatoId || !cargo || !familiaCargo) {
    return res.status(400).json({
      error: 'Debe especificar el candidato, el cargo y la familia de cargo.',
    });
  }

  // Verificar que el candidato exista
  const candidato = db.prepare('SELECT id FROM candidatos WHERE id = ?').get(candidatoId);
  if (!candidato) {
    return res.status(404).json({ error: `El candidato #${candidatoId} no existe.` });
  }

  const fechaHoy = new Date().toISOString().split('T')[0];

  const stmt = db.prepare(`
    INSERT INTO solicitudes (
      candidato_id, cargo, familia_cargo, fecha_solicitud, estado,
      profesional_responsable, observaciones, tipo_evaluacion, ubicacion,
      unidad, ceco, requiere_referencias, referido, cv, descriptor_cargo
    ) VALUES (?, ?, ?, ?, 'Pendiente', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const resultado = stmt.run(
    candidatoId,
    cargo.trim(),
    familiaCargo.trim(),
    fechaSolicitud || fechaHoy,
    profesionalResponsable?.trim() || '',
    observaciones?.trim() || '',
    tipoEvaluacion?.trim() || 'externa',
    ubicacion?.trim() || '',
    unidad?.trim() || '',
    ceco?.trim() || '',
    requiereReferencias ? 1 : 0,
    referido ? 1 : 0,
    cv?.trim() || '',
    descriptorCargo?.trim() || '',
  );

  const nueva = db.prepare('SELECT * FROM solicitudes WHERE id = ?').get(resultado.lastInsertRowid);

  res.status(201).json({
    ok: true,
    mensaje: 'Solicitud creada exitosamente.',
    solicitud: formatearSolicitud(nueva),
  });
});

/**
 * PATCH /api/solicitudes/:id/estado
 * Cambiar el estado o el profesional responsable de una solicitud
 */
router.patch('/:id/estado', autenticar, requerirRol('analista', 'evaluador'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { estado, profesionalResponsable } = req.body;

  const s = db.prepare('SELECT * FROM solicitudes WHERE id = ?').get(id);
  if (!s) {
    return res.status(404).json({ error: `Solicitud #${id} no encontrada.` });
  }

  const estadosValidos = ['Pendiente', 'En proceso', 'Finalizada'];
  if (estado && !estadosValidos.includes(estado)) {
    return res.status(400).json({
      error: `Estado inválido. Debe ser uno de: ${estadosValidos.join(', ')}.`,
    });
  }

  db.prepare(`
    UPDATE solicitudes
    SET estado = COALESCE(?, estado),
        profesional_responsable = COALESCE(?, profesional_responsable),
        actualizado_en = datetime('now')
    WHERE id = ?
  `).run(estado || null, profesionalResponsable || null, id);

  const actualizada = db.prepare('SELECT * FROM solicitudes WHERE id = ?').get(id);

  res.json({
    ok: true,
    mensaje: 'Estado de la solicitud actualizado.',
    solicitud: formatearSolicitud(actualizada),
  });
});

module.exports = router;
