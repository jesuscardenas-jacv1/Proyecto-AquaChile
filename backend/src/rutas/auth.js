const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../bd/conexion');
const { autenticar, JWT_SECRETO } = require('../middlewares/auth');

const router = express.Router();

/**
 * Límite simple de intentos fallidos de login (en memoria, por IP + correo):
 * tras MAX_INTENTOS fallos se bloquea durante VENTANA_MS. Suficiente para el MVP;
 * con varias instancias del servidor habría que usar un almacén compartido.
 */
const MAX_INTENTOS = 5;
const VENTANA_MS = 15 * 60 * 1000;
const intentosFallidos = new Map();

function claveIntento(req, correo) {
  return `${req.ip}|${correo}`;
}

function estaBloqueado(clave) {
  const registro = intentosFallidos.get(clave);
  if (!registro) return false;
  if (Date.now() - registro.desde > VENTANA_MS) {
    intentosFallidos.delete(clave);
    return false;
  }
  return registro.cantidad >= MAX_INTENTOS;
}

function registrarFallo(clave) {
  const registro = intentosFallidos.get(clave);
  if (!registro || Date.now() - registro.desde > VENTANA_MS) {
    intentosFallidos.set(clave, { cantidad: 1, desde: Date.now() });
  } else {
    registro.cantidad += 1;
  }
}

/**
 * POST /api/auth/login
 * Inicio de sesión con credenciales corporativas (correo o alias y contraseña)
 */
router.post('/login', (req, res) => {
  const { correo, contrasena } = req.body ?? {};

  if (typeof correo !== 'string' || typeof contrasena !== 'string' || !correo.trim() || !contrasena) {
    return res.status(400).json({
      error: 'Debe ingresar su correo corporativo y contraseña.',
    });
  }

  const normalizado = correo.trim().toLowerCase();
  const clave = claveIntento(req, normalizado);

  if (estaBloqueado(clave)) {
    return res.status(429).json({
      error: 'Demasiados intentos fallidos. Espere 15 minutos antes de volver a intentar.',
    });
  }

  const usuario = db
    .prepare(
      `SELECT id, nombre, correo, alias, contrasena_hash, rol, cargo, unidad
       FROM usuarios
       WHERE LOWER(correo) = ? OR LOWER(alias) = ?`,
    )
    .get(normalizado, normalizado);

  if (!usuario) {
    registrarFallo(clave);
    return res.status(401).json({
      error: 'Credenciales inválidas. Verifique su correo corporativo y contraseña.',
    });
  }

  const claveValida = bcrypt.compareSync(contrasena, usuario.contrasena_hash);
  if (!claveValida) {
    registrarFallo(clave);
    return res.status(401).json({
      error: 'Credenciales inválidas. Verifique su correo corporativo y contraseña.',
    });
  }

  intentosFallidos.delete(clave);

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

/** Solo para pruebas: limpia el registro de intentos fallidos. */
router.reiniciarIntentos = () => intentosFallidos.clear();

module.exports = router;
