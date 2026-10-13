const express = require('express');
const db = require('../bd/conexion');
const { autenticar, requerirRol } = require('../middlewares/auth');

const router = express.Router();

/**
 * GET /api/candidatos
 * Listado de todos los candidatos con soporte para filtro/búsqueda
 */
router.get('/', autenticar, (req, res) => {
  const { busqueda } = req.query;

  let query = 'SELECT * FROM candidatos';
  const params = [];

  if (busqueda && busqueda.trim()) {
    query += ' WHERE nombre LIKE ? OR correo LIKE ? OR cargo LIKE ?';
    const termino = `%${busqueda.trim()}%`;
    params.push(termino, termino, termino);
  }

  query += ' ORDER BY id DESC';

  const candidatos = db.prepare(query).all(...params);

  // Mapear nombres a camelCase para compatibilidad con el frontend
  const normalizados = candidatos.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    correo: c.correo,
    telefono: c.telefono,
    cargo: c.cargo,
    familiaCargo: c.familia_cargo,
    origen: c.origen,
    creadoEn: c.creado_en,
  }));

  res.json({ ok: true, total: normalizados.length, candidatos: normalizados });
});

/**
 * GET /api/candidatos/:id
 * Detalle de un candidato por ID
 */
router.get('/:id', autenticar, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const c = db.prepare('SELECT * FROM candidatos WHERE id = ?').get(id);

  if (!c) {
    return res.status(404).json({ error: `Candidato #${id} no encontrado.` });
  }

  res.json({
    ok: true,
    candidato: {
      id: c.id,
      nombre: c.nombre,
      correo: c.correo,
      telefono: c.telefono,
      cargo: c.cargo,
      familiaCargo: c.familia_cargo,
      origen: c.origen,
      creadoEn: c.creado_en,
    },
  });
});

/**
 * POST /api/candidatos
 * Crear un nuevo candidato (exclusivo para Analistas)
 */
router.post('/', autenticar, requerirRol('analista'), (req, res) => {
  const { nombre, correo, telefono, cargo, familiaCargo, origen } = req.body;

  if (!nombre || !correo || !telefono || !cargo || !familiaCargo) {
    return res.status(400).json({
      error: 'Todos los campos obligatorios deben ser proporcionados (nombre, correo, teléfono, cargo, familia).',
    });
  }

  const stmt = db.prepare(`
    INSERT INTO candidatos (nombre, correo, telefono, cargo, familia_cargo, origen)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const resultado = stmt.run(
    nombre.trim(),
    correo.trim().toLowerCase(),
    telefono.trim(),
    cargo.trim(),
    familiaCargo.trim(),
    origen?.trim() || 'Externo',
  );

  const nuevo = db.prepare('SELECT * FROM candidatos WHERE id = ?').get(resultado.lastInsertRowid);

  res.status(201).json({
    ok: true,
    mensaje: 'Candidato registrado exitosamente.',
    candidato: {
      id: nuevo.id,
      nombre: nuevo.nombre,
      correo: nuevo.correo,
      telefono: nuevo.telefono,
      cargo: nuevo.cargo,
      familiaCargo: nuevo.familia_cargo,
      origen: nuevo.origen,
    },
  });
});

/**
 * PUT /api/candidatos/:id
 * Actualizar los datos de un candidato (exclusivo para Analistas)
 */
router.put('/:id', autenticar, requerirRol('analista'), (req, res) => {
  const id = parseInt(req.params.id, 10);
  const c = db.prepare('SELECT * FROM candidatos WHERE id = ?').get(id);

  if (!c) {
    return res.status(404).json({ error: `Candidato #${id} no encontrado.` });
  }

  const { nombre, correo, telefono, cargo, familiaCargo, origen } = req.body;

  db.prepare(`
    UPDATE candidatos
    SET nombre = ?, correo = ?, telefono = ?, cargo = ?, familia_cargo = ?, origen = ?,
        actualizado_en = datetime('now')
    WHERE id = ?
  `).run(
    (nombre ?? c.nombre).trim(),
    (correo ?? c.correo).trim().toLowerCase(),
    (telefono ?? c.telefono).trim(),
    (cargo ?? c.cargo).trim(),
    (familiaCargo ?? c.familia_cargo).trim(),
    (origen ?? c.origen).trim(),
    id,
  );

  const actualizado = db.prepare('SELECT * FROM candidatos WHERE id = ?').get(id);

  res.json({
    ok: true,
    mensaje: 'Candidato actualizado exitosamente.',
    candidato: {
      id: actualizado.id,
      nombre: actualizado.nombre,
      correo: actualizado.correo,
      telefono: actualizado.telefono,
      cargo: actualizado.cargo,
      familiaCargo: actualizado.familia_cargo,
      origen: actualizado.origen,
    },
  });
});

/**
 * DELETE /api/candidatos/:id
 * Eliminar un candidato (exclusivo para Analistas)
 */
router.delete('/:id', autenticar, requerirRol('analista'), (req, res) => {
  const id = parseInt(req.params.id, 10);

  // Verificar si tiene solicitudes asociadas
  const solicitudes = db.prepare('SELECT COUNT(*) as total FROM solicitudes WHERE candidato_id = ?').get(id);
  if (solicitudes.total > 0) {
    return res.status(409).json({
      error: `No es posible eliminar el candidato #${id} porque tiene ${solicitudes.total} solicitud(es) asociadas.`,
    });
  }

  const resEliminar = db.prepare('DELETE FROM candidatos WHERE id = ?').run(id);

  if (resEliminar.changes === 0) {
    return res.status(404).json({ error: `Candidato #${id} no encontrado.` });
  }

  res.json({ ok: true, mensaje: `Candidato #${id} eliminado correctamente.` });
});

module.exports = router;
