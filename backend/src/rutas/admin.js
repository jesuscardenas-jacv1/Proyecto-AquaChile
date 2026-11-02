const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../bd/conexion');
const { autenticar, requerirRol } = require('../middlewares/auth');
const { sembrar } = require('../bd/semilla');

/** Herramientas del Administrador académico. */
const router = express.Router();

// requerirRol sin roles deja pasar únicamente al administrador.
const soloAdmin = [autenticar, requerirRol()];

const ROLES = ['admin', 'analista', 'evaluador', 'jefatura'];
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
const LARGO_MINIMO_CONTRASENA = 8;

const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');
const CAMPOS = 'id, nombre, correo, alias, rol, cargo, unidad';
const obtenerUsuario = (id) => db.prepare(`SELECT ${CAMPOS} FROM usuarios WHERE id = ?`).get(id);
const contarAdmins = () => db.prepare(`SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'admin'`).get().total;

const formatearUsuario = (u) => ({
  id: u.id,
  nombre: u.nombre,
  correo: u.correo,
  alias: u.alias ?? '',
  rol: u.rol,
  cargo: u.cargo ?? '',
  unidad: u.unidad ?? '',
});

/**
 * Valida los datos de un usuario de prueba. La contraseña es obligatoria al crear y
 * opcional al editar (si viene, se cambia). Devuelve { datos } o { error }.
 */
function validarUsuario(cuerpo = {}, { esNuevo }) {
  const datos = {
    nombre: texto(cuerpo.nombre),
    correo: texto(cuerpo.correo).toLowerCase(),
    rol: texto(cuerpo.rol),
    cargo: texto(cuerpo.cargo),
    unidad: texto(cuerpo.unidad),
    contrasena: typeof cuerpo.contrasena === 'string' ? cuerpo.contrasena : '',
  };
  if (datos.nombre.length < 3) return { error: 'El nombre debe tener al menos 3 caracteres.' };
  if (!CORREO_VALIDO.test(datos.correo)) return { error: 'El correo no tiene un formato válido.' };
  if (!ROLES.includes(datos.rol)) return { error: `Rol inválido. Use uno de: ${ROLES.join(', ')}.` };
  if (esNuevo && !datos.contrasena) return { error: 'La contraseña es obligatoria.' };
  if (datos.contrasena && datos.contrasena.length < LARGO_MINIMO_CONTRASENA) {
    return { error: `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.` };
  }
  return { datos };
}

/** ¿Otro usuario ya usa ese correo (como correo o como alias)? */
function correoOcupado(correo, idPropio = 0) {
  return Boolean(
    db
      .prepare('SELECT id FROM usuarios WHERE (LOWER(correo) = ? OR LOWER(alias) = ?) AND id <> ?')
      .get(correo, correo, idPropio),
  );
}

/**
 * GET /api/admin/usuarios
 * Usuarios de prueba (sin contraseñas).
 */
router.get('/usuarios', ...soloAdmin, (req, res) => {
  const usuarios = db.prepare(`SELECT ${CAMPOS} FROM usuarios ORDER BY id`).all().map(formatearUsuario);
  res.json({ ok: true, usuarios });
});

/**
 * POST /api/admin/usuarios
 * Crea un usuario de prueba: { nombre, correo, rol, cargo, unidad, contrasena }.
 */
router.post('/usuarios', ...soloAdmin, (req, res) => {
  const { datos, error } = validarUsuario(req.body, { esNuevo: true });
  if (error) return res.status(400).json({ error });
  if (correoOcupado(datos.correo)) return res.status(409).json({ error: 'Ya existe un usuario con ese correo.' });

  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO usuarios (nombre, correo, alias, contrasena_hash, rol, cargo, unidad)
       VALUES (?, ?, NULL, ?, ?, ?, ?)`,
    )
    .run(datos.nombre, datos.correo, bcrypt.hashSync(datos.contrasena, 10), datos.rol, datos.cargo, datos.unidad);

  res.status(201).json({ ok: true, mensaje: 'Usuario creado.', usuario: formatearUsuario(obtenerUsuario(lastInsertRowid)) });
});

/**
 * PUT /api/admin/usuarios/:id
 * Edita un usuario; si viene `contrasena` la reemplaza. El administrador no puede
 * quitarse a sí mismo el rol de administrador (para no dejar el sistema sin acceso).
 */
router.put('/usuarios/:id', ...soloAdmin, (req, res) => {
  const id = Number(req.params.id);
  const actual = obtenerUsuario(id);
  if (!actual) return res.status(404).json({ error: `Usuario #${id} no encontrado.` });

  const { datos, error } = validarUsuario(req.body, { esNuevo: false });
  if (error) return res.status(400).json({ error });
  if (correoOcupado(datos.correo, id)) return res.status(409).json({ error: 'Ya existe un usuario con ese correo.' });
  if (actual.rol === 'admin' && datos.rol !== 'admin') {
    if (id === req.usuario.id) {
      return res.status(400).json({ error: 'No puede quitarse a sí mismo el rol de administrador.' });
    }
    if (contarAdmins() <= 1) return res.status(400).json({ error: 'Debe quedar al menos un administrador.' });
  }

  db.prepare('UPDATE usuarios SET nombre = ?, correo = ?, rol = ?, cargo = ?, unidad = ? WHERE id = ?').run(
    datos.nombre,
    datos.correo,
    datos.rol,
    datos.cargo,
    datos.unidad,
    id,
  );
  if (datos.contrasena) {
    db.prepare('UPDATE usuarios SET contrasena_hash = ? WHERE id = ?').run(bcrypt.hashSync(datos.contrasena, 10), id);
  }

  res.json({ ok: true, mensaje: 'Usuario actualizado.', usuario: formatearUsuario(obtenerUsuario(id)) });
});

/**
 * DELETE /api/admin/usuarios/:id
 * Elimina un usuario de prueba. No permite eliminarse a sí mismo ni al último administrador.
 */
router.delete('/usuarios/:id', ...soloAdmin, (req, res) => {
  const id = Number(req.params.id);
  const actual = obtenerUsuario(id);
  if (!actual) return res.status(404).json({ error: `Usuario #${id} no encontrado.` });
  if (id === req.usuario.id) return res.status(400).json({ error: 'No puede eliminar su propio usuario.' });
  if (actual.rol === 'admin' && contarAdmins() <= 1) {
    return res.status(400).json({ error: 'Debe quedar al menos un administrador.' });
  }

  db.prepare('DELETE FROM fotos_usuario WHERE usuario_id = ?').run(id);
  db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
  res.json({ ok: true, mensaje: 'Usuario eliminado.' });
});

/**
 * POST /api/admin/reiniciar
 * Restablece la base de datos con los datos de demostración (también los 4 usuarios
 * de prueba originales).
 */
router.post('/reiniciar', ...soloAdmin, async (req, res, next) => {
  try {
    const totales = await sembrar({ silencioso: true });
    res.json({ ok: true, mensaje: 'Datos de demostración restablecidos.', totales });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
