const jwt = require('jsonwebtoken');

const SECRETO_DESARROLLO = 'aquachile-secreto-solo-desarrollo';

/**
 * En producción el secreto es obligatorio: si se usara el valor por defecto
 * (público en el repositorio) cualquiera podría firmar tokens válidos.
 */
function obtenerSecreto() {
  if (process.env.JWT_SECRETO) return process.env.JWT_SECRETO;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Falta la variable de entorno JWT_SECRETO (obligatoria en producción).');
  }
  return SECRETO_DESARROLLO;
}

const JWT_SECRETO = obtenerSecreto();

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

  const token = authHeader.slice('Bearer '.length).trim();

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
 * Middleware para restringir acceso según rol RBAC ('analista', 'evaluador', 'admin')
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

module.exports = {
  autenticar,
  requerirRol,
  JWT_SECRETO,
};
