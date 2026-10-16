const express = require('express');
const db = require('../bd/conexion');
const { autenticar, requerirRol } = require('../middlewares/auth');
const { formatearCandidato } = require('../formateo');
const {
  ErrorHttp,
  limpiar,
  idValido,
  exigirSinErrores,
  validarCandidato,
} = require('../validaciones');

const router = express.Router();

function buscarCandidato(id) {
  const candidato = db.prepare('SELECT * FROM candidatos WHERE id = ?').get(id);
  if (!candidato) throw new ErrorHttp(404, `Candidato #${id} no encontrado.`);
  return candidato;
}

/**
 * GET /api/candidatos
 * Listado de todos los candidatos con soporte para filtro/búsqueda
 */
router.get('/', autenticar, (req, res) => {
  const busqueda = limpiar(req.query.busqueda);

  let query = 'SELECT * FROM candidatos';
  const params = [];

  if (busqueda) {
    query += ' WHERE nombre LIKE ? OR correo LIKE ? OR cargo LIKE ?';
    const termino = `%${busqueda}%`;
    params.push(termino, termino, termino);
  }

  query += ' ORDER BY id DESC';

  const candidatos = db.prepare(query).all(...params).map(formatearCandidato);
  res.json({ ok: true, total: candidatos.length, candidatos });
});

/**
 * GET /api/candidatos/:id
 * Detalle de un candidato por ID
 */
router.get('/:id', autenticar, (req, res) => {
  const id = idValido(req.params.id);
  res.json({ ok: true, candidato: formatearCandidato(buscarCandidato(id)) });
});

/**
 * POST /api/candidatos
 * Crear un nuevo candidato (exclusivo para Analistas)
 */
router.post('/', autenticar, requerirRol('analista'), (req, res) => {
  const datos = req.body ?? {};
  exigirSinErrores(validarCandidato(datos));

  const resultado = db
    .prepare(
      `INSERT INTO candidatos (nombre, correo, telefono, cargo, familia_cargo, origen)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      limpiar(datos.nombre),
      limpiar(datos.correo).toLowerCase(),
      limpiar(datos.telefono),
      limpiar(datos.cargo),
      limpiar(datos.familiaCargo),
      limpiar(datos.origen) || 'Externo',
    );

  res.status(201).json({
    ok: true,
    mensaje: 'Candidato registrado exitosamente.',
    candidato: formatearCandidato(buscarCandidato(resultado.lastInsertRowid)),
  });
});

/**
 * PUT /api/candidatos/:id
 * Actualizar los datos de un candidato (exclusivo para Analistas).
 * Los campos omitidos conservan su valor actual; el resultado completo se valida.
 */
router.put('/:id', autenticar, requerirRol('analista'), (req, res) => {
  const id = idValido(req.params.id);
  const actual = buscarCandidato(id);
  const cambios = req.body ?? {};

  const combinado = {
    nombre: cambios.nombre ?? actual.nombre,
    correo: cambios.correo ?? actual.correo,
    telefono: cambios.telefono ?? actual.telefono,
    cargo: cambios.cargo ?? actual.cargo,
    familiaCargo: cambios.familiaCargo ?? actual.familia_cargo,
    origen: cambios.origen ?? actual.origen,
  };
  exigirSinErrores(validarCandidato(combinado));

  db.prepare(
    `UPDATE candidatos
     SET nombre = ?, correo = ?, telefono = ?, cargo = ?, familia_cargo = ?, origen = ?,
         actualizado_en = datetime('now')
     WHERE id = ?`,
  ).run(
    limpiar(combinado.nombre),
    limpiar(combinado.correo).toLowerCase(),
    limpiar(combinado.telefono),
    limpiar(combinado.cargo),
    limpiar(combinado.familiaCargo),
    limpiar(combinado.origen) || 'Externo',
    id,
  );

  res.json({
    ok: true,
    mensaje: 'Candidato actualizado exitosamente.',
    candidato: formatearCandidato(buscarCandidato(id)),
  });
});

/**
 * DELETE /api/candidatos/:id
 * Eliminar un candidato (exclusivo para Analistas).
 * No se permite si tiene solicitudes asociadas.
 */
router.delete('/:id', autenticar, requerirRol('analista'), (req, res) => {
  const id = idValido(req.params.id);
  buscarCandidato(id);

  const { total } = db
    .prepare('SELECT COUNT(*) AS total FROM solicitudes WHERE candidato_id = ?')
    .get(id);
  if (total > 0) {
    throw new ErrorHttp(
      409,
      `No es posible eliminar el candidato #${id} porque tiene ${total} solicitud(es) asociadas.`,
    );
  }

  db.prepare('DELETE FROM candidatos WHERE id = ?').run(id);
  res.json({ ok: true, mensaje: `Candidato #${id} eliminado correctamente.` });
});

module.exports = router;
