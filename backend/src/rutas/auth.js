const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../bd/conexion');
const { autenticar, JWT_SECRETO } = require('../middlewares/auth');

const router = express.Router();

/** Foto de perfil: imagen JPEG, PNG o WebP en data URL, ya reducida por el navegador. */
const FOTO_VALIDA = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const LARGO_MAXIMO_FOTO = 200 * 1024;
const LARGO_MINIMO_CONTRASENA = 8;

const leerFoto = (usuarioId) =>
  db.prepare('SELECT foto FROM fotos_usuario WHERE usuario_id = ?').get(usuarioId)?.foto ?? null;

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
    usuario: { ...usuarioSeguro, foto: leerFoto(usuario.id) },
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

  res.json({ ok: true, usuario: { ...usuario, foto: leerFoto(usuario.id) } });
});

/**
 * PUT /api/auth/perfil/foto
 * Cuerpo: { foto: 'data:image/jpeg;base64,...' }. Cada usuario cambia solo su propia foto.
 */
router.put('/perfil/foto', autenticar, (req, res) => {
  const foto = typeof req.body?.foto === 'string' ? req.body.foto : '';
  if (!FOTO_VALIDA.test(foto)) {
    return res.status(400).json({ error: 'La foto debe ser una imagen JPG, PNG o WebP.' });
  }
  if (foto.length > LARGO_MAXIMO_FOTO) {
    return res.status(413).json({ error: 'La foto es demasiado grande.' });
  }
  db.prepare(
    `INSERT INTO fotos_usuario (usuario_id, foto) VALUES (?, ?)
     ON CONFLICT(usuario_id) DO UPDATE SET foto = excluded.foto, actualizado_en = datetime('now')`,
  ).run(req.usuario.id, foto);
  res.json({ ok: true, mensaje: 'Foto actualizada.', foto });
});

/**
 * DELETE /api/auth/perfil/foto
 * Quita la foto de perfil (vuelven a mostrarse las iniciales).
 */
router.delete('/perfil/foto', autenticar, (req, res) => {
  db.prepare('DELETE FROM fotos_usuario WHERE usuario_id = ?').run(req.usuario.id);
  res.json({ ok: true, mensaje: 'Foto eliminada.' });
});

/**
 * PUT /api/auth/contrasena
 * Cuerpo: { actual, nueva }. Pide la contraseña actual para cambiarla.
 */
router.put('/contrasena', autenticar, (req, res) => {
  const { actual, nueva } = req.body ?? {};
  if (typeof nueva !== 'string' || nueva.length < LARGO_MINIMO_CONTRASENA) {
    return res
      .status(400)
      .json({ error: `La nueva contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.` });
  }
  const usuario = db.prepare('SELECT contrasena_hash FROM usuarios WHERE id = ?').get(req.usuario.id);
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });
  if (typeof actual !== 'string' || !bcrypt.compareSync(actual, usuario.contrasena_hash)) {
    return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
  }
  if (actual === nueva) {
    return res.status(400).json({ error: 'La nueva contraseña debe ser distinta de la actual.' });
  }
  db.prepare('UPDATE usuarios SET contrasena_hash = ? WHERE id = ?').run(bcrypt.hashSync(nueva, 10), req.usuario.id);
  res.json({ ok: true, mensaje: 'Contraseña actualizada.' });
});

module.exports = router;
