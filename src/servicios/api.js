/**
 * Cliente de la API REST del backend (Hito 2: integración Full Stack).
 *
 * La app funciona en dos modos:
 * - "api": hay backend; los datos se leen y guardan en la base de datos (SQLite).
 * - "local": no hay backend (p. ej. GitHub Pages sin servidor); los datos de
 *   demostración viven en el navegador. Las pruebas unitarias usan este modo.
 */

export const URL_API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';
const CLAVE_TOKEN = 'aquachile_token_api';

/** En las pruebas unitarias nunca se llama al backend real. */
export const API_HABILITADA = import.meta.env.MODE !== 'test' && import.meta.env.VITE_API_URL !== '';

/** Error de la API; `noDisponible` indica que el backend no está accesible o la sesión venció. */
export class ErrorApi extends Error {
  constructor(mensaje, { status = 0, noDisponible = false } = {}) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.status = status;
    this.noDisponible = noDisponible;
  }
}

export function obtenerToken() {
  try {
    return sessionStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

export function guardarToken(token) {
  try {
    if (token) sessionStorage.setItem(CLAVE_TOKEN, token);
    else sessionStorage.removeItem(CLAVE_TOKEN);
  } catch {
    // Sin sessionStorage la app queda en modo local.
  }
}

/**
 * ¿Responde el backend? Reintenta una vez antes de rendirse: al abrir la página justo
 * después de encender el equipo, la primera llamada puede fallar aunque el servidor esté arriba.
 */
export async function backendDisponible({ esperaMs = 4000, intentos = 2, pausaMs = 500 } = {}) {
  for (let intento = 1; intento <= intentos; intento += 1) {
    const control = new AbortController();
    const temporizador = setTimeout(() => control.abort(), esperaMs);
    try {
      const respuesta = await fetch(`${URL_API}/salud`, { signal: control.signal });
      if (respuesta.ok) return true;
    } catch {
      // Sin respuesta: se reintenta.
    } finally {
      clearTimeout(temporizador);
    }
    if (intento < intentos) await new Promise((resolver) => setTimeout(resolver, pausaMs));
  }
  return false;
}

/**
 * Llama a la API y devuelve el JSON. Con `publico` no envía el token.
 * Un 401 borra el token (sesión vencida) y se informa como no disponible.
 */
export async function solicitar(ruta, { metodo = 'GET', cuerpo, publico = false } = {}) {
  const token = obtenerToken();
  if (!publico && !token) {
    throw new ErrorApi('Sin sesión en el servidor. Vuelva a iniciar sesión.', { status: 401, noDisponible: true });
  }

  let respuesta;
  try {
    respuesta = await fetch(`${URL_API}${ruta}`, {
      method: metodo,
      headers: {
        ...(publico ? {} : { Authorization: `Bearer ${token}` }),
        ...(cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi('No se pudo conectar con el servidor.', { noDisponible: true });
  }

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    if (respuesta.status === 401) guardarToken(null);
    throw new ErrorApi(datos.error ?? `Error ${respuesta.status} del servidor.`, {
      status: respuesta.status,
      noDisponible: respuesta.status === 401,
    });
  }
  return datos;
}

/**
 * Inicia sesión en el backend. Devuelve { ok, usuario } o { ok:false, error };
 * lanza ErrorApi con `noDisponible` si el servidor no responde (se usa el modo local).
 */
export async function iniciarSesionApi(correo, contrasena) {
  try {
    const datos = await solicitar('/auth/login', { metodo: 'POST', cuerpo: { correo, contrasena }, publico: true });
    guardarToken(datos.token);
    return { ok: true, usuario: datos.usuario };
  } catch (error) {
    if (error.noDisponible && error.status !== 401) throw error;
    return { ok: false, error: error.message };
  }
}

export function cerrarSesionApi() {
  guardarToken(null);
}

const ROLES_CON_POSTULACIONES = ['admin', 'analista', 'jefatura'];

/** Operaciones de datos sobre la API, con la misma forma que usa DatosContext. */
export const apiDatos = {
  /** Lo que ve cualquiera, con o sin sesión: las ofertas abiertas. */
  async cargarPublico() {
    const { ofertas } = await solicitar('/ofertas', { publico: true });
    return { ofertas };
  },

  /** Todo lo que el usuario con sesión puede ver según su rol. */
  async cargarTodo(rol) {
    const [candidatos, solicitudes, evaluaciones, ofertas, postulaciones] = await Promise.all([
      solicitar('/candidatos'),
      solicitar('/solicitudes'),
      solicitar('/evaluaciones'),
      solicitar('/ofertas', { publico: true }),
      ROLES_CON_POSTULACIONES.includes(rol) ? solicitar('/postulaciones') : { postulaciones: [] },
    ]);
    return {
      candidatos: candidatos.candidatos,
      solicitudes: solicitudes.solicitudes,
      evaluaciones: evaluaciones.evaluaciones,
      ofertas: ofertas.ofertas,
      postulaciones: postulaciones.postulaciones,
    };
  },

  crearCandidato: async (datos) => (await solicitar('/candidatos', { metodo: 'POST', cuerpo: datos })).candidato,
  actualizarCandidato: async (id, datos) =>
    (await solicitar(`/candidatos/${id}`, { metodo: 'PUT', cuerpo: datos })).candidato,
  eliminarCandidato: (id) => solicitar(`/candidatos/${id}`, { metodo: 'DELETE' }),

  crearSolicitud: async (datos) => (await solicitar('/solicitudes', { metodo: 'POST', cuerpo: datos })).solicitud,
  /** Estado y/o psicóloga responsable. */
  actualizarSolicitud: async (id, cambios) =>
    (await solicitar(`/solicitudes/${id}/estado`, { metodo: 'PATCH', cuerpo: cambios })).solicitud,
  /** Corrige los datos de la solicitud (cargo, familia, ubicación, CECO, etc.). */
  editarSolicitud: async (id, cambios) =>
    (await solicitar(`/solicitudes/${id}`, { metodo: 'PATCH', cuerpo: cambios })).solicitud,
  moverEtapa: async (id, etapa, agenda = {}) =>
    (await solicitar(`/solicitudes/${id}/etapa`, { metodo: 'PATCH', cuerpo: { etapa, ...agenda } })).solicitud,

  /** Crea la evaluación o, si la solicitud ya tiene una, la actualiza. */
  async guardarEvaluacion(solicitudId, datos, existenteId) {
    const respuesta = existenteId
      ? await solicitar(`/evaluaciones/${existenteId}`, { metodo: 'PUT', cuerpo: datos })
      : await solicitar('/evaluaciones', { metodo: 'POST', cuerpo: { solicitudId, ...datos } });
    return respuesta.evaluacion;
  },

  postular: async (ofertaId, datos) =>
    (await solicitar('/postulaciones', { metodo: 'POST', cuerpo: { ofertaId, ...datos }, publico: true }))
      .postulacion,
  actualizarPostulacion: async (id, cambios) =>
    (await solicitar(`/postulaciones/${id}`, { metodo: 'PATCH', cuerpo: cambios })).postulacion,

  reiniciar: () => solicitar('/admin/reiniciar', { metodo: 'POST' }),
};

/** Mantenedor de usuarios de prueba (solo administrador). */
export const apiAdmin = {
  listarUsuarios: async () => (await solicitar('/admin/usuarios')).usuarios,
  crearUsuario: async (datos) => (await solicitar('/admin/usuarios', { metodo: 'POST', cuerpo: datos })).usuario,
  actualizarUsuario: async (id, datos) =>
    (await solicitar(`/admin/usuarios/${id}`, { metodo: 'PUT', cuerpo: datos })).usuario,
  eliminarUsuario: (id) => solicitar(`/admin/usuarios/${id}`, { metodo: 'DELETE' }),
};
