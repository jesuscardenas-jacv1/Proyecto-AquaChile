const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../bd/conexion');
const { autenticar, JWT_SECRETO } = require('../middlewares/auth');

const router = express.Router();

/**
 * POST /api/auth/login
 * Inicio de sesión con credenciales corporativas (correo o alias y contraseña)
 */
router.post('/login', (req, res) => {
  const { correo, contrasena } = req.body;

  if (!correo || !contrasena) {
    return res.status(400).json({
      error: 'Debe ingresar su correo corporativo y contraseña.',
    });
  }

  const normalizado = correo.trim().toLowerCase();

  const usuario = db
    .prepare(
      `SELECT id, nombre, correo, alias, contrasena_hash, rol, cargo, unidad
       FROM usuarios
       WHERE LOWER(correo) = ? OR LOWER(alias) = ?`,
    )
    .get(normalizado, normalizado);

  if (!usuario) {
    return res.status(401).json({
      error: 'Credenciales inválidas. Verifique su correo corporativo y contraseña.',
    });
  }

  const claveValida = bcrypt.compareSync(contrasena, usuario.contrasena_hash);
  if (!claveValida) {
    return res.status(401).json({
      error: 'Credenciales inválidas. Verifique su correo corporativo y contraseña.',
    });
  }

  // Generar token JWT de 8 horas
  const payload = {
    id: usuario.id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    rol: usuario.rol,
    cargo: usuario.cargo,
  };

  const token = jwt.sign(payload, JWT_SECRETO, { expiresIn: '8h' });

  // Devolver usuario sin la contraseña hash
  const { contrasena_hash, ...usuarioSeguro } = usuario;

  return res.json({
    ok: true,
    mensaje: 'Autenticación exitosa en AquaChile.',
    usuario: usuarioSeguro,
    token,
  });
});

/**
 * GET /api/auth/perfil
 * Retorna los datos del usuario logueado
 */
router.get('/perfil', autenticar, (req, res) => {
  const usuario = db
    .prepare(
      `SELECT id, nombre, correo, alias, rol, cargo, unidad, creado_en
       FROM usuarios
       WHERE id = ?`,
    )
    .get(req.usuario.id);

  if (!usuario) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  res.json({ ok: true, usuario });
});

module.exports = router;
