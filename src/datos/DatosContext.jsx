import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { cargarDatos, generarId, guardarDatos, obtenerSemilla } from './almacen';
import { ESTADOS_EVALUACION } from './constantes';
import { estadoSolicitudDesdeEvaluacion } from '../dominio/indicadores';

const ContextoDatos = createContext(null);

const normalizarCandidato = (datos) => ({
  nombre: datos.nombre.trim(),
  correo: datos.correo.trim().toLowerCase(),
  telefono: datos.telefono.trim(),
  cargo: datos.cargo.trim(),
  familiaCargo: datos.familiaCargo,
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

  const eliminarCandidato = useCallback((id) => {
    setDatos((actual) => ({
      ...actual,
      candidatos: actual.candidatos.filter((candidato) => candidato.id !== Number(id)),
    }));
  }, []);

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
        profesionalResponsable: nueva.profesionalResponsable ?? '',
        observaciones: nueva.observaciones?.trim() ?? '',
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
        const evaluacion = existente
          ? { ...existente, ...registro }
          : { id: generarId(actual.evaluaciones), solicitudId: Number(solicitudId), ...registro };

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
