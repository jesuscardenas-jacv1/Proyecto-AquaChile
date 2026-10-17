const jwt = require('jsonwebtoken');

const JWT_SECRETO = process.env.JWT_SECRETO || 'aquachile-secreto-mvp-2026';

/**
 * Middleware para validar token JWT en cabecera Authorization: Bearer <token>
 */
function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Acceso no autorizado: se requiere token de autenticación.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decodificado = jwt.verify(token, JWT_SECRETO);
    req.usuario = decodificado;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Token inválido o expirado.',
    });
  }
}

/**
 * Middleware para restringir acceso según rol RBAC ('admin', 'analista', 'evaluador', 'jefatura').
 * El admin pasa siempre; la jefatura solo consulta, por eso no se incluye en rutas de escritura.
 */
function requerirRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'Usuario no autenticado.' });
    }

    if (req.usuario.rol === 'admin' || rolesPermitidos.includes(req.usuario.rol)) {
      return next();
    }

    return res.status(403).json({
      error: `Acceso denegado: se requiere uno de los siguientes roles: ${rolesPermitidos.join(', ')}.`,
    });
  };
}

/**
 * Solo el profesional evaluador (y el administrador) ve las observaciones clínicas;
 * el analista y la jefatura ven únicamente el dictamen.
 */
function puedeVerNotasClinicas(rol) {
  return rol === 'evaluador' || rol === 'admin';
}

module.exports = {
  autenticar,
  requerirRol,
  puedeVerNotasClinicas,
  JWT_SECRETO,
};
