const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const LARGO_MINIMO_SECRETO = 32;

/**
 * Clave con que se firman los JWT. Nunca hay un valor fijo en el código (el repo es público):
 * - Con JWT_SECRETO definido se usa ese valor (mínimo 32 caracteres).
 * - En producción (NODE_ENV=production) es obligatorio: sin él el servidor no arranca.
 * - En desarrollo y pruebas, si falta, se genera uno aleatorio solo para esa ejecución
 *   (las sesiones se cierran al reiniciar el backend).
 */
function resolverSecreto(entorno = process.env, aviso = console.warn) {
  const secreto = entorno.JWT_SECRETO?.trim();
  if (secreto) {
    if (secreto.length < LARGO_MINIMO_SECRETO) {
      throw new Error(`JWT_SECRETO debe tener al menos ${LARGO_MINIMO_SECRETO} caracteres.`);
    }
    return secreto;
  }
  if (entorno.NODE_ENV === 'production') {
    throw new Error('Falta JWT_SECRETO: defínalo como variable de entorno antes de iniciar en producción.');
  }
  aviso('⚠️  JWT_SECRETO no definido: se usa uno aleatorio solo para esta ejecución.');
  return crypto.randomBytes(48).toString('base64url');
}

const JWT_SECRETO = resolverSecreto();

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
  resolverSecreto,
};
