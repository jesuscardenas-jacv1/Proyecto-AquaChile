/**
 * Catálogo de usuarios simulados y servicio de autenticación corporativa para AquaChile.
 *
 * Roles disponibles:
 * - 'analista': Analista de Reclutamiento y Selección.
 * - 'evaluador': Profesional Evaluador / Psicólogo/a Laboral.
 */

export const USUARIOS = [
  {
    id: 1,
    nombre: 'Carolina Muñoz',
    correo: 'carolina.munoz@aquachile.cl',
    alias: 'analista@aquachile.cl',
    contrasena: 'AquaChile2026!',
    rol: 'analista',
    cargo: 'Analista de Reclutamiento',
    unidad: 'Gestión de Personas',
  },
  {
    id: 2,
    nombre: 'María Victoria Bustamante',
    correo: 'mvictoria.bustamante@aquachile.cl',
    alias: 'evaluador@aquachile.cl',
    contrasena: 'AquaChile2026!',
    rol: 'evaluador',
    cargo: 'Psicóloga Evaluadora',
    unidad: 'Reclutamiento y Selección',
  },
];

/**
 * Valida credenciales contra el catálogo de usuarios corporativos.
 * Acepta tanto el correo nominal como el alias de rol (ej. analista@aquachile.cl).
 *
 * @param {string} correo
 * @param {string} contrasena
 * @returns {{ ok: boolean, usuario?: object, error?: string }}
 */
export function autenticarUsuario(correo, contrasena) {
  if (!correo || !contrasena) {
    return { ok: false, error: 'Debe ingresar su correo corporativo y contraseña.' };
  }

  const normalizado = correo.trim().toLowerCase();
  const usuario = USUARIOS.find(
    (u) => u.correo.toLowerCase() === normalizado || u.alias.toLowerCase() === normalizado,
  );

  if (!usuario || usuario.contrasena !== contrasena) {
    return {
      ok: false,
      error: 'Credenciales inválidas. Verifique su correo corporativo y contraseña.',
    };
  }

  // Devolvemos el usuario sanitizado (sin exponer la contraseña en el estado)
  const { contrasena: _password, ...usuarioSeguro } = usuario;
  return { ok: true, usuario: usuarioSeguro };
}
