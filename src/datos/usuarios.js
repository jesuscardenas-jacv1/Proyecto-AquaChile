/**
 * Catálogo de usuarios simulados y servicio de autenticación corporativa para AquaChile.
 * Los cuatro roles son los que define el caso académico (sección 4.3).
 */

/** Roles del sistema: etiqueta visible y lo que puede hacer cada uno. */
export const ROLES = {
  admin: {
    etiqueta: 'Administrador',
    nombre: 'Administrador académico',
    descripcion: 'Configura usuarios de prueba, catálogos y datos de demostración.',
    permisos: ['Todo lo del analista y del evaluador', 'Restablecer los datos de demostración'],
  },
  analista: {
    etiqueta: 'Analista',
    nombre: 'Analista de Reclutamiento',
    descripcion: 'Registra candidatos y genera solicitudes de evaluación.',
    permisos: ['Crear y editar candidatos', 'Crear solicitudes', 'Asignar responsable y estado', 'Subir CV y descriptor'],
  },
  evaluador: {
    etiqueta: 'Evaluador',
    nombre: 'Profesional Evaluador',
    descripcion: 'Registra la evaluación psicolaboral y actualiza el estado.',
    permisos: ['Actualizar estado', 'Registrar fecha, resultado y observaciones', 'Gestionar el Planner', 'Generar el informe'],
  },
  jefatura: {
    etiqueta: 'Jefatura',
    nombre: 'Jefatura / contraparte',
    descripcion: 'Revisa indicadores y el avance de las solicitudes.',
    permisos: ['Consultar dashboard y listados en modo lectura'],
  },
};

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
    nombre: 'Ignacia Valdés Ortiz',
    correo: 'ignacia.valdes@aquachile.cl',
    alias: 'evaluador@aquachile.cl',
    contrasena: 'AquaChile2026!',
    rol: 'evaluador',
    cargo: 'Psicóloga Evaluadora',
    unidad: 'Reclutamiento y Selección',
  },
  {
    id: 3,
    nombre: 'Andrés Valdivia',
    correo: 'andres.valdivia@aquachile.cl',
    alias: 'admin@aquachile.cl',
    contrasena: 'AquaChile2026!',
    rol: 'admin',
    cargo: 'Administrador Académico',
    unidad: 'Proyecto DSY1104',
  },
  {
    id: 4,
    nombre: 'Patricia Saavedra',
    correo: 'patricia.saavedra@aquachile.cl',
    alias: 'jefatura@aquachile.cl',
    contrasena: 'AquaChile2026!',
    rol: 'jefatura',
    cargo: 'Jefa de Reclutamiento y Selección',
    unidad: 'Gestión de Personas',
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
