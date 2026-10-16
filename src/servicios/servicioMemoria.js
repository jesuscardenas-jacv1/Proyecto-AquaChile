import { ESTADOS_EVALUACION } from '../datos/constantes';
import { generarId, guardarDatos } from '../datos/almacen';
import { autenticarUsuario } from '../datos/usuarios';
import { calcularDiasRespuesta, estadoSolicitudDesdeEvaluacion } from '../dominio/indicadores';
import { estadoDeEtapa } from '../dominio/planner';
import { ErrorApi } from './errores';

/**
 * Servicio de datos en memoria, con la misma interfaz que servicioApi.
 * Se usa en las pruebas automáticas y en el "modo demo" (GitHub Pages, sin backend),
 * donde además persiste en localStorage. Aplica las mismas reglas de negocio que la API
 * para que la app se comporte igual en ambos modos.
 */

const clonar = (valor) => (valor === undefined ? undefined : structuredClone(valor));

const normalizarCandidato = (datos) => ({
  nombre: datos.nombre.trim(),
  correo: datos.correo.trim().toLowerCase(),
  telefono: datos.telefono.trim(),
  cargo: datos.cargo.trim(),
  familiaCargo: datos.familiaCargo,
  // El origen solo se informa al crear la solicitud; al editar se conserva el existente.
  ...(datos.origen ? { origen: datos.origen } : {}),
});

const ESTADOS_QUE_PERMITEN_EVALUAR = ['En proceso', 'Finalizada'];

export function crearServicioMemoria(datosIniciales, { persistir = false } = {}) {
  let datos = clonar(datosIniciales);

  const confirmar = (nuevos) => {
    datos = nuevos;
    if (persistir) guardarDatos(datos);
  };

  const buscar = (coleccion, id, mensaje) => {
    const encontrado = datos[coleccion].find((item) => item.id === Number(id));
    if (!encontrado) throw new ErrorApi(404, mensaje);
    return encontrado;
  };

  const reemplazar = (coleccion, actualizado) =>
    datos[coleccion].map((item) => (item.id === actualizado.id ? actualizado : item));

  return {
    modo: 'memoria',

    /** Copia síncrona de los datos actuales (permite pintar la app sin esperar). */
    obtenerInstantanea() {
      return clonar(datos);
    },

    async iniciarSesion(correo, contrasena) {
      const resultado = autenticarUsuario(correo, contrasena);
      if (!resultado.ok) throw new ErrorApi(401, resultado.error);
      return { usuario: resultado.usuario, token: null };
    },

    async cargarDatos() {
      return clonar(datos);
    },

    async crearCandidato(nuevo) {
      const candidato = { id: generarId(datos.candidatos), ...normalizarCandidato(nuevo) };
      confirmar({ ...datos, candidatos: [...datos.candidatos, candidato] });
      return clonar(candidato);
    },

    async actualizarCandidato(id, cambios) {
      const actual = buscar('candidatos', id, `Candidato #${id} no encontrado.`);
      const candidato = { ...actual, ...normalizarCandidato(cambios) };
      confirmar({ ...datos, candidatos: reemplazar('candidatos', candidato) });
      return clonar(candidato);
    },

    async eliminarCandidato(id) {
      buscar('candidatos', id, `Candidato #${id} no encontrado.`);
      const total = datos.solicitudes.filter((s) => s.candidatoId === Number(id)).length;
      if (total > 0) {
        throw new ErrorApi(
          409,
          `No se puede eliminar: el candidato tiene ${total} solicitud(es) asociada(s).`,
        );
      }
      confirmar({
        ...datos,
        candidatos: datos.candidatos.filter((candidato) => candidato.id !== Number(id)),
      });
    },

    async crearSolicitud(nueva) {
      const solicitud = {
        id: generarId(datos.solicitudes),
        candidatoId: Number(nueva.candidatoId),
        cargo: nueva.cargo.trim(),
        familiaCargo: nueva.familiaCargo,
        fechaSolicitud: nueva.fechaSolicitud,
        estado: 'Pendiente',
        etapa: 'recibida',
        profesionalResponsable: nueva.profesionalResponsable ?? '',
        observaciones: nueva.observaciones?.trim() ?? '',
        tipoEvaluacion: nueva.tipoEvaluacion ?? '',
        ubicacion: nueva.ubicacion?.trim() ?? '',
        unidad: nueva.unidad ?? '',
        ceco: nueva.ceco ?? '',
        requiereReferencias: Boolean(nueva.requiereReferencias),
        referido: nueva.referido ?? null,
        cv: nueva.cv ?? '',
        descriptorCargo: nueva.descriptorCargo ?? '',
      };
      confirmar({ ...datos, solicitudes: [...datos.solicitudes, solicitud] });
      return clonar(solicitud);
    },

    async actualizarSolicitud(id, cambios) {
      const actual = buscar('solicitudes', id, `Solicitud #${id} no encontrada.`);
      if (cambios.estado === 'Finalizada') {
        const evaluacion = datos.evaluaciones.find((e) => e.solicitudId === Number(id));
        if (!evaluacion?.resultado) {
          throw new ErrorApi(
            409,
            `La solicitud #${id} no puede finalizarse sin una evaluación registrada.`,
          );
        }
      }
      const solicitud = { ...actual, ...cambios };
      confirmar({ ...datos, solicitudes: reemplazar('solicitudes', solicitud) });
      return clonar(solicitud);
    },

    /**
     * Mueve una solicitud a otra etapa del Planner y sincroniza su estado oficial.
     * Al volver a "Evaluación Recibida" la entrevista queda nuevamente por coordinar.
     */
    async moverEtapa(id, etapa, agenda = {}) {
      const actual = buscar('solicitudes', id, `Solicitud #${id} no encontrada.`);
      const datosAgenda =
        etapa === 'recibida'
          ? { fechaEntrevista: '', horaEntrevista: '', modalidadEntrevista: '' }
          : {
              ...(agenda.fechaEntrevista ? { fechaEntrevista: agenda.fechaEntrevista } : {}),
              ...(agenda.horaEntrevista ? { horaEntrevista: agenda.horaEntrevista } : {}),
              ...(agenda.modalidadEntrevista
                ? { modalidadEntrevista: agenda.modalidadEntrevista }
                : {}),
            };
      const solicitud = { ...actual, ...datosAgenda, etapa, estado: estadoDeEtapa(etapa) };
      confirmar({ ...datos, solicitudes: reemplazar('solicitudes', solicitud) });
      return clonar(solicitud);
    },

    /** Registra o actualiza la evaluación de una solicitud y actualiza su estado. */
    async registrarEvaluacion(solicitudId, datosEvaluacion) {
      const actual = buscar('solicitudes', solicitudId, `La solicitud #${solicitudId} no existe.`);
      if (!ESTADOS_QUE_PERMITEN_EVALUAR.includes(actual.estado)) {
        throw new ErrorApi(
          409,
          `La solicitud #${solicitudId} está "${actual.estado}": debe estar En proceso para evaluarla.`,
        );
      }

      const registro = {
        fechaEvaluacion: datosEvaluacion.fechaEvaluacion,
        resultado: datosEvaluacion.resultado,
        observaciones: datosEvaluacion.observaciones.trim(),
        estado: ESTADOS_EVALUACION.includes(datosEvaluacion.estado)
          ? datosEvaluacion.estado
          : 'Realizada',
      };
      const existente = datos.evaluaciones.find(
        (evaluacion) => evaluacion.solicitudId === Number(solicitudId),
      );
      const base = existente
        ? { ...existente, ...registro }
        : { id: generarId(datos.evaluaciones), solicitudId: Number(solicitudId), ...registro };
      // Días corridos hasta el informe; si aún no hay fecha de informe se usa la de evaluación
      const evaluacion = {
        ...base,
        diasRespuesta: calcularDiasRespuesta(
          actual.fechaSolicitud,
          base.fechaInforme || base.fechaEvaluacion,
        ),
      };
      const solicitud = { ...actual, estado: estadoSolicitudDesdeEvaluacion(evaluacion) };

      confirmar({
        ...datos,
        evaluaciones: existente
          ? reemplazar('evaluaciones', evaluacion)
          : [...datos.evaluaciones, evaluacion],
        solicitudes: reemplazar('solicitudes', solicitud),
      });
      return { evaluacion: clonar(evaluacion), solicitud: clonar(solicitud) };
    },

    /** Restaura un conjunto de datos completo (solo modo memoria: demos y pruebas). */
    async reiniciar(nuevosDatos) {
      confirmar(clonar(nuevosDatos));
      return clonar(datos);
    },
  };
}
