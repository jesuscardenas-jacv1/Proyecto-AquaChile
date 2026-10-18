import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { COLECCIONES, cargarDatos, generarId, guardarDatos, obtenerSemilla } from './almacen';
import { ESTADOS_EVALUACION } from './constantes';
import { estadoSolicitudDesdeEvaluacion } from '../dominio/indicadores';
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
  // Las colecciones que falten (p. ej. en datos de prueba antiguos) parten vacías.
  const [datos, setDatos] = useState(() => {
    const iniciales = datosIniciales ?? cargarDatos();
    return Object.fromEntries(COLECCIONES.map((coleccion) => [coleccion, iniciales[coleccion] ?? []]));
  });

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

  /* --------------------------- Ofertas y postulaciones --------------------------- */

  const obtenerOferta = useCallback(
    (id) => datos.ofertas.find((oferta) => oferta.id === Number(id)) ?? null,
    [datos.ofertas],
  );

  const obtenerPostulacion = useCallback(
    (id) => datos.postulaciones.find((postulacion) => postulacion.id === Number(id)) ?? null,
    [datos.postulaciones],
  );

  /**
   * Registra una postulación desde el portal público. Si ya existe un candidato con el
   * mismo correo se reutiliza; si no, se crea con el cargo y familia de la oferta.
   */
  const postular = useCallback(
    (ofertaId, datosPostulante) => {
      const oferta = datos.ofertas.find((item) => item.id === Number(ofertaId));
      if (!oferta) throw new Error('La oferta no existe o ya no está disponible.');

      const correo = datosPostulante.correo.trim().toLowerCase();
      const existente = datos.candidatos.find((candidato) => candidato.correo === correo);
      const candidato = existente ?? {
        id: generarId(datos.candidatos),
        ...normalizarCandidato({
          nombre: datosPostulante.nombre,
          correo,
          telefono: datosPostulante.telefono,
          cargo: oferta.cargo,
          familiaCargo: oferta.familiaCargo,
          origen: datosPostulante.origen,
        }),
      };
      const postulacion = {
        id: generarId(datos.postulaciones),
        ofertaId: oferta.id,
        candidatoId: candidato.id,
        fechaPostulacion: new Date().toISOString().slice(0, 10),
        estado: 'Recibida',
        ciudad: datosPostulante.ciudad.trim(),
        cvNombre: datosPostulante.cvNombre ?? '',
        solicitudId: null,
      };

      setDatos((actual) => ({
        ...actual,
        candidatos: existente ? actual.candidatos : [...actual.candidatos, candidato],
        postulaciones: [...actual.postulaciones, postulacion],
      }));
      return { postulacion, candidato };
    },
    [datos.ofertas, datos.candidatos, datos.postulaciones],
  );

  const actualizarPostulacion = useCallback((id, cambios) => {
    setDatos((actual) => ({
      ...actual,
      postulaciones: actual.postulaciones.map((postulacion) =>
        postulacion.id === Number(id) ? { ...postulacion, ...cambios } : postulacion,
      ),
    }));
  }, []);

  /** Restaura los datos semilla (útil para demos y pruebas). */
  const reiniciarDatos = useCallback(() => {
    setDatos(obtenerSemilla());
  }, []);

  const valor = useMemo(
    () => ({
      candidatos: datos.candidatos,
      solicitudes: datos.solicitudes,
      evaluaciones: datos.evaluaciones,
      ofertas: datos.ofertas,
      postulaciones: datos.postulaciones,
      obtenerOferta,
      obtenerPostulacion,
      postular,
      actualizarPostulacion,
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
      obtenerOferta,
      obtenerPostulacion,
      postular,
      actualizarPostulacion,
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
