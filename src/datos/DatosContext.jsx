import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { cargarDatos, generarId, guardarDatos, obtenerSemilla } from './almacen';
import { ESTADOS_EVALUACION } from './constantes';
import { calcularDiasRespuesta, estadoSolicitudDesdeEvaluacion } from '../dominio/indicadores';
import { estadoDeEtapa } from '../dominio/planner';

const ContextoDatos = createContext(null);

const normalizarCandidato = (datos) => ({
  nombre: datos.nombre.trim(),
  correo: datos.correo.trim().toLowerCase(),
  telefono: datos.telefono.trim(),
  cargo: datos.cargo.trim(),
  familiaCargo: datos.familiaCargo,
  // El origen solo se informa al crear la solicitud; al editar se conserva el existente.
  ...(datos.origen ? { origen: datos.origen } : {}),
});

/**
 * Proveedor de datos simulados de la aplicación.
 * Mantiene candidatos, solicitudes y evaluaciones, y los persiste en localStorage.
 */
export function ProveedorDatos({ children, datosIniciales }) {
  const [datos, setDatos] = useState(() => datosIniciales ?? cargarDatos());

  useEffect(() => {
    guardarDatos(datos);
  }, [datos]);

  /* ------------------------------- Candidatos ------------------------------ */

  const agregarCandidato = useCallback((nuevo) => {
    const candidato = { id: generarId(datos.candidatos), ...normalizarCandidato(nuevo) };
    setDatos((actual) => ({ ...actual, candidatos: [...actual.candidatos, candidato] }));
    return candidato;
  }, [datos.candidatos]);

  const actualizarCandidato = useCallback((id, cambios) => {
    setDatos((actual) => ({
      ...actual,
      candidatos: actual.candidatos.map((candidato) =>
        candidato.id === Number(id) ? { ...candidato, ...normalizarCandidato(cambios) } : candidato,
      ),
    }));
  }, []);

  /**
   * Elimina un candidato solo si no tiene solicitudes asociadas (misma regla que la API,
   * que responde 409): así no quedan solicitudes apuntando a un candidato inexistente.
   * @returns {{ ok: boolean, error?: string }}
   */
  const eliminarCandidato = useCallback(
    (id) => {
      const total = datos.solicitudes.filter(
        (solicitud) => solicitud.candidatoId === Number(id),
      ).length;
      if (total > 0) {
        return {
          ok: false,
          error: `No se puede eliminar: el candidato tiene ${total} solicitud(es) asociada(s).`,
        };
      }
      setDatos((actual) => ({
        ...actual,
        candidatos: actual.candidatos.filter((candidato) => candidato.id !== Number(id)),
      }));
      return { ok: true };
    },
    [datos.solicitudes],
  );

  const obtenerCandidato = useCallback(
    (id) => datos.candidatos.find((candidato) => candidato.id === Number(id)) ?? null,
    [datos.candidatos],
  );

  /* ------------------------------- Solicitudes ----------------------------- */

  const agregarSolicitud = useCallback(
    (nueva) => {
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
      setDatos((actual) => ({
        ...actual,
        solicitudes: [...actual.solicitudes, solicitud],
      }));
      return solicitud;
    },
    [datos.solicitudes],
  );

  const actualizarSolicitud = useCallback((id, cambios) => {
    setDatos((actual) => ({
      ...actual,
      solicitudes: actual.solicitudes.map((solicitud) =>
        solicitud.id === Number(id) ? { ...solicitud, ...cambios } : solicitud,
      ),
    }));
  }, []);

  const obtenerSolicitud = useCallback(
    (id) => datos.solicitudes.find((solicitud) => solicitud.id === Number(id)) ?? null,
    [datos.solicitudes],
  );

  /**
   * Mueve una solicitud a otra etapa del Planner y sincroniza su estado oficial.
   * Si se entregan datos de agenda (fecha, hora, modalidad) se guardan con la etapa;
   * al volver a "Evaluación Recibida" la entrevista queda nuevamente por coordinar.
   */
  const moverEtapa = useCallback((id, etapa, agenda = {}) => {
    setDatos((actual) => ({
      ...actual,
      solicitudes: actual.solicitudes.map((solicitud) => {
        if (solicitud.id !== Number(id)) return solicitud;
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
        return { ...solicitud, ...datosAgenda, etapa, estado: estadoDeEtapa(etapa) };
      }),
    }));
  }, []);

  const asignarProfesional = useCallback((id, profesional) => {
    setDatos((actual) => ({
      ...actual,
      solicitudes: actual.solicitudes.map((solicitud) =>
        solicitud.id === Number(id)
          ? { ...solicitud, profesionalResponsable: profesional }
          : solicitud,
      ),
    }));
  }, []);

  /* ------------------------------ Evaluaciones ----------------------------- */

  const obtenerEvaluacionDeSolicitud = useCallback(
    (solicitudId) =>
      datos.evaluaciones.find((evaluacion) => evaluacion.solicitudId === Number(solicitudId)) ??
      null,
    [datos.evaluaciones],
  );

  /** Registra o actualiza la evaluación de una solicitud y actualiza su estado. */
  const registrarEvaluacion = useCallback(
    (solicitudId, datosEvaluacion) => {
      const registro = {
        fechaEvaluacion: datosEvaluacion.fechaEvaluacion,
        resultado: datosEvaluacion.resultado,
        observaciones: datosEvaluacion.observaciones.trim(),
        estado: ESTADOS_EVALUACION.includes(datosEvaluacion.estado)
          ? datosEvaluacion.estado
          : 'Realizada',
      };

      setDatos((actual) => {
        const existente = actual.evaluaciones.find(
          (evaluacion) => evaluacion.solicitudId === Number(solicitudId),
        );
        const base = existente
          ? { ...existente, ...registro }
          : { id: generarId(actual.evaluaciones), solicitudId: Number(solicitudId), ...registro };
        // Días de respuesta (corridos) hasta el informe; si aún no hay fecha de informe
        // se usa la de evaluación, igual que la API al registrar la evaluación.
        const solicitud = actual.solicitudes.find((item) => item.id === Number(solicitudId));
        const diasRespuesta = calcularDiasRespuesta(
          solicitud?.fechaSolicitud,
          base.fechaInforme || base.fechaEvaluacion,
        );
        const evaluacion = { ...base, diasRespuesta };

        return {
          ...actual,
          evaluaciones: existente
            ? actual.evaluaciones.map((item) => (item.id === existente.id ? evaluacion : item))
            : [...actual.evaluaciones, evaluacion],
          solicitudes: actual.solicitudes.map((solicitud) =>
            solicitud.id === Number(solicitudId)
              ? { ...solicitud, estado: estadoSolicitudDesdeEvaluacion(evaluacion) }
              : solicitud,
          ),
        };
      });

      return registro;
    },
    [],
  );

  /** Restaura los datos semilla (útil para demos y pruebas). */
  const reiniciarDatos = useCallback(() => {
    setDatos(obtenerSemilla());
  }, []);

  const valor = useMemo(
    () => ({
      candidatos: datos.candidatos,
      solicitudes: datos.solicitudes,
      evaluaciones: datos.evaluaciones,
      agregarCandidato,
      actualizarCandidato,
      eliminarCandidato,
      obtenerCandidato,
      agregarSolicitud,
      actualizarSolicitud,
      obtenerSolicitud,
      asignarProfesional,
      moverEtapa,
      registrarEvaluacion,
      obtenerEvaluacionDeSolicitud,
      reiniciarDatos,
    }),
    [
      datos,
      agregarCandidato,
      actualizarCandidato,
      eliminarCandidato,
      obtenerCandidato,
      agregarSolicitud,
      actualizarSolicitud,
      obtenerSolicitud,
      asignarProfesional,
      moverEtapa,
      registrarEvaluacion,
      obtenerEvaluacionDeSolicitud,
      reiniciarDatos,
    ],
  );

  return <ContextoDatos.Provider value={valor}>{children}</ContextoDatos.Provider>;
}

/** Hook de acceso a los datos de la aplicación. */
export function useDatos() {
  const contexto = useContext(ContextoDatos);
  if (!contexto) {
    throw new Error('useDatos debe usarse dentro de un <ProveedorDatos>.');
  }
  return contexto;
}

export { ContextoDatos };
