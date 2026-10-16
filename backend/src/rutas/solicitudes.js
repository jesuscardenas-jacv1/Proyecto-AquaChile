const express = require('express');
const db = require('../bd/conexion');
const { autenticar, requerirRol } = require('../middlewares/auth');
const { formatearCandidato, formatearSolicitud, formatearEvaluacion } = require('../formateo');
const {
  ErrorHttp,
  ESTADOS_SOLICITUD,
  limpiar,
  idValido,
  exigirSinErrores,
  validarSolicitud,
} = require('../validaciones');
const {
  ESTADO_DE_ETAPA,
  ETAPA_POR_ESTADO,
  ETAPAS_MANUALES,
  validarAgenda,
  traeAgenda,
} = require('../planner');

const router = express.Router();

/**
 * GET /api/solicitudes
 * Listado de solicitudes con filtros opcionales de estado, tipo y búsqueda
 */
router.get('/', autenticar, (req, res) => {
  const estado = limpiar(req.query.estado);
  const tipoEvaluacion = limpiar(req.query.tipoEvaluacion);
  const busqueda = limpiar(req.query.busqueda);

  let query = `
    SELECT s.*, c.nombre as candidato_nombre
    FROM solicitudes s
    LEFT JOIN candidatos c ON s.candidato_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (estado) {
    query += ' AND s.estado = ?';
    params.push(estado);
  }

  if (tipoEvaluacion) {
    query += ' AND s.tipo_evaluacion = ?';
    params.push(tipoEvaluacion);
  }

  if (busqueda) {
    query += ' AND (c.nombre LIKE ? OR s.cargo LIKE ? OR s.profesional_responsable LIKE ?)';
    const term = `%${busqueda}%`;
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
  const id = idValido(req.params.id);

  const s = db
    .prepare(
      `SELECT s.*, c.nombre as candidato_nombre
       FROM solicitudes s
       LEFT JOIN candidatos c ON s.candidato_id = c.id
       WHERE s.id = ?`,
    )
    .get(id);

  if (!s) {
    throw new ErrorHttp(404, `Solicitud #${id} no encontrada.`);
  }

  const candidato = db.prepare('SELECT * FROM candidatos WHERE id = ?').get(s.candidato_id);
  const evaluacion = db.prepare('SELECT * FROM evaluaciones WHERE solicitud_id = ?').get(id);

  res.json({
    ok: true,
    solicitud: formatearSolicitud(s),
    candidato: candidato ? formatearCandidato(candidato) : null,
    // Sanitizada según rol: el analista no recibe las observaciones clínicas
    evaluacion: evaluacion ? formatearEvaluacion(evaluacion, req.usuario.rol) : null,
  });
});

/**
 * POST /api/solicitudes
 * Crear una nueva solicitud de evaluación (exclusivo para Analistas)
 */
router.post('/', autenticar, requerirRol('analista'), (req, res) => {
  const datos = req.body ?? {};
  exigirSinErrores(validarSolicitud(datos));

  const candidatoId = Number(datos.candidatoId);
  const candidato = db.prepare('SELECT id FROM candidatos WHERE id = ?').get(candidatoId);
  if (!candidato) {
    throw new ErrorHttp(404, `El candidato #${candidatoId} no existe.`);
  }

  const fechaHoy = new Date().toISOString().split('T')[0];
  // referido admite null (sin dato / no aplica), igual que en el frontend
  const referido =
    datos.referido === undefined || datos.referido === null ? null : datos.referido ? 1 : 0;

  const resultado = db
    .prepare(
      `INSERT INTO solicitudes (
        candidato_id, cargo, familia_cargo, fecha_solicitud, estado,
        profesional_responsable, observaciones, tipo_evaluacion, ubicacion,
        unidad, ceco, requiere_referencias, referido, cv, descriptor_cargo, etapa
      ) VALUES (?, ?, ?, ?, 'Pendiente', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'recibida')`,
    )
    .run(
      candidatoId,
      limpiar(datos.cargo),
      limpiar(datos.familiaCargo),
      limpiar(datos.fechaSolicitud) || fechaHoy,
      limpiar(datos.profesionalResponsable),
      limpiar(datos.observaciones),
      limpiar(datos.tipoEvaluacion) || 'externa',
      limpiar(datos.ubicacion),
      limpiar(datos.unidad),
      limpiar(datos.ceco),
      datos.requiereReferencias ? 1 : 0,
      referido,
      limpiar(datos.cv),
      limpiar(datos.descriptorCargo),
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
router.patch('/:id/estado', autenticar, (req, res) => {
  const id = idValido(req.params.id);
  const { estado, profesionalResponsable } = req.body ?? {};

  const s = db.prepare('SELECT * FROM solicitudes WHERE id = ?').get(id);
  if (!s) {
    throw new ErrorHttp(404, `Solicitud #${id} no encontrada.`);
  }

  if (estado === undefined && profesionalResponsable === undefined) {
    throw new ErrorHttp(400, 'Debe indicar el nuevo estado o el profesional responsable.');
  }

  if (estado !== undefined && !ESTADOS_SOLICITUD.includes(estado)) {
    throw new ErrorHttp(400, `Estado inválido. Debe ser uno de: ${ESTADOS_SOLICITUD.join(', ')}.`);
  }

  if (profesionalResponsable !== undefined && typeof profesionalResponsable !== 'string') {
    throw new ErrorHttp(400, 'El profesional responsable debe ser un texto.');
  }

  // Regla de negocio: una solicitud solo se finaliza con una evaluación con dictamen.
  if (estado === 'Finalizada') {
    const evaluacion = db
      .prepare("SELECT id FROM evaluaciones WHERE solicitud_id = ? AND resultado <> ''")
      .get(id);
    if (!evaluacion) {
      throw new ErrorHttp(
        409,
        `La solicitud #${id} no puede finalizarse sin una evaluación registrada.`,
      );
    }
  }

  // La etapa del Planner debe calzar con el estado: si el nuevo estado no corresponde
  // a la etapa guardada, se usa la etapa por defecto de ese estado.
  const nuevaEtapa =
    estado && ESTADO_DE_ETAPA[s.etapa] !== estado ? ETAPA_POR_ESTADO[estado] : s.etapa;

  db.prepare(
    `UPDATE solicitudes
     SET estado = COALESCE(?, estado),
         profesional_responsable = COALESCE(?, profesional_responsable),
         etapa = ?,
         actualizado_en = datetime('now')
     WHERE id = ?`,
  ).run(
    estado ?? null,
    profesionalResponsable === undefined ? null : profesionalResponsable.trim(),
    nuevaEtapa ?? null,
    id,
  );

  const actualizada = db.prepare('SELECT * FROM solicitudes WHERE id = ?').get(id);

  res.json({
    ok: true,
    mensaje: 'Estado de la solicitud actualizado.',
    solicitud: formatearSolicitud(actualizada),
  });
});

/**
 * PATCH /api/solicitudes/:id/etapa
 * Mueve una solicitud entre las etapas del Planner (exclusivo Evaluador) y sincroniza
 * su estado oficial. Body: { etapa, fechaEntrevista?, horaEntrevista?, modalidadEntrevista? }
 * - recibida: vuelve a "por coordinar" y borra los datos de la entrevista.
 * - agendada: exige fecha, hora y modalidad si la solicitud aún no los tiene (o si se envían).
 * - realizada: requiere una entrevista agendada.
 * - informe: no se asigna a mano; se alcanza al registrar la evaluación.
 */
router.patch('/:id/etapa', autenticar, requerirRol('evaluador'), (req, res) => {
  const id = idValido(req.params.id);
  const datos = req.body ?? {};
  const { etapa } = datos;

  const s = db.prepare('SELECT * FROM solicitudes WHERE id = ?').get(id);
  if (!s) {
    throw new ErrorHttp(404, `Solicitud #${id} no encontrada.`);
  }

  if (etapa === 'informe') {
    throw new ErrorHttp(
      400,
      'La etapa "Informe enviado" se alcanza registrando la evaluación de la solicitud.',
    );
  }
  if (!ETAPAS_MANUALES.includes(etapa)) {
    throw new ErrorHttp(400, `Etapa inválida. Debe ser una de: ${ETAPAS_MANUALES.join(', ')}.`);
  }
  if (s.estado === 'Finalizada') {
    throw new ErrorHttp(409, `La solicitud #${id} ya tiene su informe enviado y no se reabre.`);
  }

  let agenda = {
    fecha: s.fecha_entrevista,
    hora: s.hora_entrevista,
    modalidad: s.modalidad_entrevista,
  };

  if (etapa === 'recibida') {
    agenda = { fecha: '', hora: '', modalidad: '' };
  } else if (traeAgenda(datos) || !s.fecha_entrevista) {
    if (etapa === 'realizada' && !traeAgenda(datos)) {
      throw new ErrorHttp(409, 'La entrevista debe estar agendada antes de marcarla como realizada.');
    }
    exigirSinErrores(validarAgenda(datos, s.fecha_solicitud));
    agenda = {
      fecha: datos.fechaEntrevista.trim(),
      hora: datos.horaEntrevista.trim(),
      modalidad: datos.modalidadEntrevista,
    };
  }

  db.prepare(
    `UPDATE solicitudes
     SET etapa = ?, estado = ?,
         fecha_entrevista = ?, hora_entrevista = ?, modalidad_entrevista = ?,
         actualizado_en = datetime('now')
     WHERE id = ?`,
  ).run(etapa, ESTADO_DE_ETAPA[etapa], agenda.fecha, agenda.hora, agenda.modalidad, id);

  const actualizada = db
    .prepare(
      `SELECT s.*, c.nombre as candidato_nombre
       FROM solicitudes s LEFT JOIN candidatos c ON s.candidato_id = c.id
       WHERE s.id = ?`,
    )
    .get(id);

  res.json({
    ok: true,
    mensaje: 'Etapa de la solicitud actualizada.',
    solicitud: formatearSolicitud(actualizada),
  });
});

module.exports = router;
