const express = require('express');
const db = require('../bd/conexion');
const { autenticar, requerirRol } = require('../middlewares/auth');
const { formatearCandidato } = require('../bd/formatos');

const router = express.Router();

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');
const obtener = (id) => db.prepare('SELECT * FROM candidatos WHERE id = ?').get(id);

/** El evaluador solo ve a los candidatos que pasaron a evaluación (tienen solicitud). */
const SOLO_EN_EVALUACION = 'EXISTS (SELECT 1 FROM solicitudes s WHERE s.candidato_id = candidatos.id)';
const soloEnEvaluacion = (req) => req.usuario.rol === 'evaluador';

/**
 * GET /api/candidatos
 * Listado de candidatos (?busqueda= por nombre, correo o cargo).
 */
router.get('/', autenticar, (req, res) => {
  const condiciones = [];
  const params = [];

  if (soloEnEvaluacion(req)) condiciones.push(SOLO_EN_EVALUACION);
  if (texto(req.query.busqueda)) {
    condiciones.push('(nombre LIKE ? OR correo LIKE ? OR cargo LIKE ?)');
    const termino = `%${texto(req.query.busqueda)}%`;
    params.push(termino, termino, termino);
  }

  const where = condiciones.length ? ` WHERE ${condiciones.join(' AND ')}` : '';
  const candidatos = db
    .prepare(`SELECT * FROM candidatos${where} ORDER BY id`)
    .all(...params)
    .map(formatearCandidato);
  res.json({ ok: true, total: candidatos.length, candidatos });
});

/**
 * GET /api/candidatos/:id
 */
router.get('/:id', autenticar, (req, res) => {
  const id = Number(req.params.id);
  const candidato = db
    .prepare(`SELECT * FROM candidatos WHERE id = ?${soloEnEvaluacion(req) ? ` AND ${SOLO_EN_EVALUACION}` : ''}`)
    .get(id);
  if (!candidato) {
    return res.status(404).json({ error: `Candidato #${id} no encontrado.` });
  }
  res.json({ ok: true, candidato: formatearCandidato(candidato) });
});

function validarCandidato(datos) {
  const { nombre, correo, telefono, cargo, familiaCargo } = datos;
  if (!texto(nombre) || !texto(correo) || !texto(telefono) || !texto(cargo) || !texto(familiaCargo)) {
    return 'Todos los campos obligatorios deben ser proporcionados (nombre, correo, teléfono, cargo, familia).';
  }
  if (!CORREO_VALIDO.test(texto(correo))) return 'El correo no tiene un formato válido.';
  return null;
}

/**
 * POST /api/candidatos
 * Registrar un candidato (analista).
 */
router.post('/', autenticar, requerirRol('analista'), (req, res) => {
  const error = validarCandidato(req.body);
  if (error) return res.status(400).json({ error });

  const { nombre, correo, telefono, cargo, familiaCargo, origen } = req.body;
  const resultado = db
    .prepare(
      `INSERT INTO candidatos (nombre, correo, telefono, cargo, familia_cargo, origen)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      texto(nombre),
      texto(correo).toLowerCase(),
      texto(telefono),
      texto(cargo),
      texto(familiaCargo),
      texto(origen) || 'Externo',
    );

  res.status(201).json({
    ok: true,
    mensaje: 'Candidato registrado exitosamente.',
    candidato: formatearCandidato(obtener(resultado.lastInsertRowid)),
  });
});

/**
 * PUT /api/candidatos/:id
 * Actualizar un candidato (analista). Los campos ausentes conservan su valor.
 */
router.put('/:id', autenticar, requerirRol('analista'), (req, res) => {
  const id = Number(req.params.id);
  const actual = obtener(id);
  if (!actual) {
    return res.status(404).json({ error: `Candidato #${id} no encontrado.` });
  }

  const datos = { ...formatearCandidato(actual), ...req.body };
  const error = validarCandidato(datos);
  if (error) return res.status(400).json({ error });

  db.prepare(
    `UPDATE candidatos
     SET nombre = ?, correo = ?, telefono = ?, cargo = ?, familia_cargo = ?, origen = ?,
         actualizado_en = datetime('now')
     WHERE id = ?`,
  ).run(
    texto(datos.nombre),
    texto(datos.correo).toLowerCase(),
    texto(datos.telefono),
    texto(datos.cargo),
    texto(datos.familiaCargo),
    texto(datos.origen) || 'Externo',
    id,
  );

  res.json({ ok: true, mensaje: 'Candidato actualizado exitosamente.', candidato: formatearCandidato(obtener(id)) });
});

/**
 * DELETE /api/candidatos/:id
 * Eliminar un candidato (analista). No se permite si tiene solicitudes (trazabilidad).
 */
router.delete('/:id', autenticar, requerirRol('analista'), (req, res) => {
  const id = Number(req.params.id);
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM solicitudes WHERE candidato_id = ?').get(id);
  if (total > 0) {
    return res.status(409).json({
      error: `No es posible eliminar al candidato: tiene ${total} solicitud(es) de evaluación asociadas.`,
    });
  }
  const resultado = db.prepare('DELETE FROM candidatos WHERE id = ?').run(id);
  if (resultado.changes === 0) {
    return res.status(404).json({ error: `Candidato #${id} no encontrado.` });
  }
  res.json({ ok: true, mensaje: 'Candidato eliminado exitosamente.' });
});

module.exports = router;
