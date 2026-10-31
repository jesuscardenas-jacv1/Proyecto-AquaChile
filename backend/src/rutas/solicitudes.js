const express = require('express');
const db = require('../bd/conexion');
const { autenticar, requerirRol } = require('../middlewares/auth');
const { formatearCandidato, formatearEvaluacion, formatearSolicitud } = require('../bd/formatos');
const { obtenerAlmacenamiento } = require('../almacenamiento');
const { claveCarpeta, nombreCarpeta } = require('../almacenamiento/comun');

const router = express.Router();

const ESTADOS = ['Pendiente', 'En proceso', 'Finalizada'];
/** Etapas del Planner y el estado oficial que corresponde a cada una (igual que el frontend). */
const ESTADO_DE_ETAPA = {
  recibida: 'Pendiente',
  agendada: 'En proceso',
  realizada: 'En proceso',
  informe: 'Finalizada',
};
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

const obtener = (id) => db.prepare('SELECT * FROM solicitudes WHERE id = ?').get(id);
const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');

/**
 * GET /api/solicitudes
 * Listado con filtros opcionales: estado, tipoEvaluacion, busqueda, responsable
 * (psicóloga), desde y hasta (fecha de solicitud, yyyy-mm-dd, inclusivas).
 */
router.get('/', autenticar, (req, res) => {
  const { estado, tipoEvaluacion, busqueda, responsable, desde, hasta } = req.query;

  let query = `
    SELECT s.*
    FROM solicitudes s
    LEFT JOIN candidatos c ON s.candidato_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (texto(estado)) {
    query += ' AND s.estado = ?';
    params.push(texto(estado));
  }
  if (texto(tipoEvaluacion)) {
    query += ' AND s.tipo_evaluacion = ?';
    params.push(texto(tipoEvaluacion));
  }
  if (texto(responsable)) {
    query += ' AND s.profesional_responsable = ?';
    params.push(texto(responsable));
  }
  for (const [valor, operador] of [
    [desde, '>='],
    [hasta, '<='],
  ]) {
    if (!texto(valor)) continue;
    if (!FECHA_ISO.test(texto(valor))) {
      return res.status(400).json({ error: 'Las fechas deben tener el formato yyyy-mm-dd.' });
    }
    query += ` AND s.fecha_solicitud ${operador} ?`;
    params.push(texto(valor));
  }
  if (texto(busqueda)) {
    query +=
      ' AND (c.nombre LIKE ? OR s.cargo LIKE ? OR s.reclutador LIKE ? OR s.profesional_responsable LIKE ?)';
    const termino = `%${texto(busqueda)}%`;
    params.push(termino, termino, termino, termino);
  }

  query += ' ORDER BY s.fecha_solicitud DESC, s.id DESC';
  const solicitudes = db.prepare(query).all(...params).map(formatearSolicitud);
  res.json({ ok: true, total: solicitudes.length, solicitudes });
});

/**
 * GET /api/solicitudes/:id
 * Detalle de la solicitud, su candidato y su evaluación (sin notas clínicas para
 * analista y jefatura).
 */
router.get('/:id', autenticar, (req, res) => {
  const id = Number(req.params.id);
  const solicitud = obtener(id);
  if (!solicitud) {
    return res.status(404).json({ error: `Solicitud #${id} no encontrada.` });
  }

  const candidato = db.prepare('SELECT * FROM candidatos WHERE id = ?').get(solicitud.candidato_id);
  const evaluacion = db.prepare('SELECT * FROM evaluaciones WHERE solicitud_id = ?').get(id);

  res.json({
    ok: true,
    solicitud: formatearSolicitud(solicitud),
    candidato: candidato ? formatearCandidato(candidato) : null,
    evaluacion: evaluacion ? formatearEvaluacion(evaluacion, req.usuario.rol) : null,
  });
});

/**
 * Crea la carpeta de documentos de la solicitud ("S0001 - Nombre del postulante") en el
 * proveedor configurado. Si falla (p. ej. Google Drive no responde) la solicitud ya quedó
 * guardada: se informa el motivo y la carpeta se vuelve a intentar al subir el primer archivo.
 */
async function crearCarpetaSolicitud(id) {
  try {
    const fila = db
      .prepare('SELECT c.nombre FROM solicitudes s JOIN candidatos c ON c.id = s.candidato_id WHERE s.id = ?')
      .get(id);
    const carpeta = await obtenerAlmacenamiento().obtenerCarpeta(
      claveCarpeta(id),
      nombreCarpeta(id, fila?.nombre),
      { crear: true },
    );
    return { carpeta, avisoCarpeta: null };
  } catch (error) {
    console.error(`⚠️  No se pudo crear la carpeta de la solicitud #${id}:`, error.message);
    return {
      carpeta: null,
      avisoCarpeta: `La solicitud se creó, pero no su carpeta de documentos: ${error.message}`,
    };
  }
}

/**
 * POST /api/solicitudes
 * Crear una solicitud de evaluación (analista). Queda Pendiente, en la etapa
 * "recibida" del Planner, y se crea su carpeta de documentos.
 */
router.post('/', autenticar, requerirRol('analista'), async (req, res, next) => {
  try {
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
      reclutador,
      profesionalResponsable,
    } = req.body;

    if (!candidatoId || !texto(cargo) || !texto(familiaCargo)) {
      return res.status(400).json({
        error: 'Debe especificar el candidato, el cargo y la familia de cargo.',
      });
    }
    if (fechaSolicitud && !FECHA_ISO.test(fechaSolicitud)) {
      return res.status(400).json({ error: 'La fecha de solicitud debe tener el formato yyyy-mm-dd.' });
    }
    if (!db.prepare('SELECT id FROM candidatos WHERE id = ?').get(candidatoId)) {
      return res.status(404).json({ error: `El candidato #${candidatoId} no existe.` });
    }

    const resultado = db
      .prepare(
        `INSERT INTO solicitudes (
          candidato_id, cargo, familia_cargo, fecha_solicitud, estado, etapa, reclutador,
          profesional_responsable, observaciones, tipo_evaluacion, ubicacion, unidad, ceco,
          requiere_referencias, referido, cv, descriptor_cargo
        ) VALUES (?, ?, ?, ?, 'Pendiente', 'recibida', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        candidatoId,
        texto(cargo),
        texto(familiaCargo),
        fechaSolicitud || new Date().toISOString().slice(0, 10),
        texto(reclutador),
        texto(profesionalResponsable),
        texto(observaciones),
        texto(tipoEvaluacion) || 'externa',
        texto(ubicacion),
        texto(unidad),
        texto(ceco),
        requiereReferencias ? 1 : 0,
        referido === null || referido === undefined ? null : referido ? 1 : 0,
        texto(cv),
        texto(descriptorCargo),
      );

    const id = Number(resultado.lastInsertRowid);
    const { carpeta, avisoCarpeta } = await crearCarpetaSolicitud(id);

    res.status(201).json({
      ok: true,
      mensaje: 'Solicitud creada exitosamente.',
      solicitud: formatearSolicitud(obtener(id)),
      carpeta,
      avisoCarpeta,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/solicitudes/:id/estado
 * Cambia el estado y/o la psicóloga responsable ("" la deja sin asignar).
 */
router.patch('/:id/estado', autenticar, requerirRol('analista', 'evaluador'), (req, res) => {
  const id = Number(req.params.id);
  const actual = obtener(id);
  if (!actual) {
    return res.status(404).json({ error: `Solicitud #${id} no encontrada.` });
  }

  const { estado } = req.body;
  if (estado !== undefined && !ESTADOS.includes(estado)) {
    return res.status(400).json({ error: `Estado inválido. Debe ser uno de: ${ESTADOS.join(', ')}.` });
  }
  const responsable =
    'profesionalResponsable' in req.body ? texto(req.body.profesionalResponsable) : actual.profesional_responsable;

  db.prepare(
    `UPDATE solicitudes
     SET estado = ?, profesional_responsable = ?, actualizado_en = datetime('now')
     WHERE id = ?`,
  ).run(estado ?? actual.estado, responsable, id);

  res.json({ ok: true, mensaje: 'Solicitud actualizada.', solicitud: formatearSolicitud(obtener(id)) });
});

/**
 * PATCH /api/solicitudes/:id/etapa
 * Mueve la solicitud en el Planner (evaluador) y sincroniza su estado oficial.
 * Volver a "recibida" deja la entrevista nuevamente por coordinar.
 */
router.patch('/:id/etapa', autenticar, requerirRol('evaluador'), (req, res) => {
  const id = Number(req.params.id);
  const actual = obtener(id);
  if (!actual) {
    return res.status(404).json({ error: `Solicitud #${id} no encontrada.` });
  }

  const { etapa, fechaEntrevista, horaEntrevista, modalidadEntrevista } = req.body;
  if (!ESTADO_DE_ETAPA[etapa]) {
    return res.status(400).json({
      error: `Etapa inválida. Debe ser una de: ${Object.keys(ESTADO_DE_ETAPA).join(', ')}.`,
    });
  }
  if (fechaEntrevista && !FECHA_ISO.test(fechaEntrevista)) {
    return res.status(400).json({ error: 'La fecha de la entrevista debe tener el formato yyyy-mm-dd.' });
  }

  const agenda =
    etapa === 'recibida'
      ? { fecha: '', hora: '', modalidad: '' }
      : {
          fecha: texto(fechaEntrevista) || actual.fecha_entrevista,
          hora: texto(horaEntrevista) || actual.hora_entrevista,
          modalidad: texto(modalidadEntrevista) || actual.modalidad_entrevista,
        };

  db.prepare(
    `UPDATE solicitudes
     SET etapa = ?, estado = ?, fecha_entrevista = ?, hora_entrevista = ?, modalidad_entrevista = ?,
         actualizado_en = datetime('now')
     WHERE id = ?`,
  ).run(etapa, ESTADO_DE_ETAPA[etapa], agenda.fecha, agenda.hora, agenda.modalidad, id);

  res.json({ ok: true, mensaje: 'Etapa actualizada.', solicitud: formatearSolicitud(obtener(id)) });
});

module.exports = router;
