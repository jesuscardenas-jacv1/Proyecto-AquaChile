import { ErrorApi } from './errores';
import { EVENTO_SESION_EXPIRADA, leerToken } from './sesion';

/**
 * Servicio de datos que trabaja contra la API REST del backend (Express + SQLite).
 * Todas las operaciones devuelven promesas y, si fallan, lanzan ErrorApi.
 *
 * @param {object} opciones
 * @param {string} opciones.urlBase      URL base de la API (ej. '/api' o 'https://.../api')
 * @param {Function} opciones.obtenerToken devuelve el JWT de la sesión activa
 * @param {Function} opciones.fetch      implementación de fetch (inyectable en pruebas)
 */
export function crearServicioApi({
  urlBase = '/api',
  obtenerToken = leerToken,
  fetch: fetchImpl = (...args) => globalThis.fetch(...args),
} = {}) {
  async function pedir(metodo, ruta, cuerpo) {
    const token = obtenerToken();
    let respuesta;
    try {
      respuesta = await fetchImpl(`${urlBase}${ruta}`, {
        method: metodo,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}),
      });
    } catch {
      throw new ErrorApi(
        0,
        'No se pudo conectar con el servidor. Verifique que la API esté en ejecución.',
      );
    }

    const datos = await respuesta.json().catch(() => null);

    if (!respuesta.ok) {
      // Token vencido o inválido en una petición autenticada: se cierra la sesión
      if (respuesta.status === 401 && token && typeof window !== 'undefined') {
        window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA));
      }
      throw new ErrorApi(
        respuesta.status,
        datos?.error || `La API respondió con un error (${respuesta.status}).`,
        datos?.errores ?? null,
      );
    }
    return datos;
  }

  return {
    modo: 'api',

    async iniciarSesion(correo, contrasena) {
      const datos = await pedir('POST', '/auth/login', { correo, contrasena });
      return { usuario: datos.usuario, token: datos.token };
    },

    async cargarDatos() {
      const [candidatos, solicitudes, evaluaciones] = await Promise.all([
        pedir('GET', '/candidatos'),
        pedir('GET', '/solicitudes'),
        pedir('GET', '/evaluaciones'),
      ]);
      return {
        candidatos: candidatos.candidatos,
        solicitudes: solicitudes.solicitudes,
        evaluaciones: evaluaciones.evaluaciones,
      };
    },

    async crearCandidato(datos) {
      return (await pedir('POST', '/candidatos', datos)).candidato;
    },

    async actualizarCandidato(id, cambios) {
      return (await pedir('PUT', `/candidatos/${id}`, cambios)).candidato;
    },

    async eliminarCandidato(id) {
      await pedir('DELETE', `/candidatos/${id}`);
    },

    async crearSolicitud(datos) {
      return (await pedir('POST', '/solicitudes', datos)).solicitud;
    },

    /** Cambia el estado y/o el profesional responsable. */
    async actualizarSolicitud(id, cambios) {
      return (await pedir('PATCH', `/solicitudes/${id}/estado`, cambios)).solicitud;
    },

    async moverEtapa(id, etapa, agenda = {}) {
      return (await pedir('PATCH', `/solicitudes/${id}/etapa`, { etapa, ...agenda })).solicitud;
    },

    /**
     * Registra (POST) o actualiza (PUT) la evaluación y devuelve también la solicitud,
     * porque la API cambia su estado al registrarla.
     */
    async registrarEvaluacion(solicitudId, datos, evaluacionExistente = null) {
      const cuerpo = {
        fechaEvaluacion: datos.fechaEvaluacion,
        resultado: datos.resultado,
        observaciones: datos.observaciones,
      };
      const { evaluacion } = evaluacionExistente
        ? await pedir('PUT', `/evaluaciones/${evaluacionExistente.id}`, cuerpo)
        : await pedir('POST', '/evaluaciones', { solicitudId, ...cuerpo });
      const { solicitud } = await pedir('GET', `/solicitudes/${solicitudId}`);
      return { evaluacion, solicitud };
    },
  };
}
