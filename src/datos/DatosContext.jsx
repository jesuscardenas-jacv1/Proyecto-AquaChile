import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { COLECCIONES, cargarDatos, generarId, guardarDatos, obtenerSemilla } from './almacen';
import { ESTADOS_EVALUACION } from './constantes';
import { useAuth } from './AuthContext';
import { estadoSolicitudDesdeEvaluacion } from '../dominio/indicadores';
import { estadoDeEtapa } from '../dominio/planner';
import { API_HABILITADA, apiDatos, backendDisponible, obtenerToken } from '../servicios/api';

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

/** Las colecciones que falten (p. ej. en datos de prueba antiguos) parten vacías. */
const completar = (datos = {}) =>
  Object.fromEntries(COLECCIONES.map((coleccion) => [coleccion, datos[coleccion] ?? []]));

const reemplazarPorId = (lista, item) =>
  lista.some((actual) => actual.id === item.id)
    ? lista.map((actual) => (actual.id === item.id ? item : actual))
    : [...lista, item];

/**
 * Proveedor de los datos de la aplicación (candidatos, solicitudes, evaluaciones,
 * ofertas y postulaciones), en uno de dos modos:
 *
 * - "api": hay backend. Los datos se cargan desde la API REST y cada cambio se guarda
 *   en la base de datos; el estado en memoria refleja la respuesta del servidor.
 * - "local": no hay backend (GitHub Pages sin servidor) o se entregan `datosIniciales`
 *   (pruebas). Los datos de demostración viven en el navegador (localStorage).
 *
 * Todas las acciones son asíncronas y devuelven el registro resultante, o `null` si el
 * servidor rechazó la operación (el motivo queda en `errorOperacion`).
 */
export function ProveedorDatos({
  children,
  datosIniciales,
  api = apiDatos,
  apiHabilitada = API_HABILITADA,
  comprobarServidor = backendDisponible,
}) {
  const { usuarioActual, cerrarSesion } = useAuth();
  const usarApi = !datosIniciales && apiHabilitada;

  const [modo, setModo] = useState(usarApi ? 'conectando' : 'local');
  const [cargando, setCargando] = useState(usarApi);
  const [errorOperacion, setErrorOperacion] = useState(null);
  const [datos, setDatos] = useState(() => (usarApi ? completar() : completar(datosIniciales ?? cargarDatos())));

  // Siempre la versión más reciente de los datos, para las acciones asíncronas.
  const datosRef = useRef(datos);
  datosRef.current = datos;

  /* ------------------------------- Modo y carga ------------------------------ */

  useEffect(() => {
    if (!usarApi) return undefined;
    let vigente = true;
    comprobarServidor().then((disponible) => {
      if (!vigente) return;
      if (disponible) {
        setModo('api');
      } else {
        setDatos(completar(cargarDatos()));
        setModo('local');
        setCargando(false);
      }
    });
    return () => {
      vigente = false;
    };
  }, [usarApi, comprobarServidor]);

  const rol = usuarioActual?.rol;
  const idUsuario = usuarioActual?.id;

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      if (idUsuario && !obtenerToken()) {
        // Sesión iniciada sin servidor: hay que volver a entrar para usar la base de datos.
        cerrarSesion();
        return;
      }
      const cargados = idUsuario ? await api.cargarTodo(rol) : await api.cargarPublico();
      setDatos(completar(cargados));
    } catch (error) {
      setErrorOperacion(error.message);
      if (error.status === 401) cerrarSesion();
    } finally {
      setCargando(false);
    }
  }, [api, rol, idUsuario, cerrarSesion]);

  useEffect(() => {
    if (modo === 'api') cargar();
  }, [modo, cargar]);

  useEffect(() => {
    if (modo === 'local') guardarDatos(datos);
  }, [modo, datos]);

  const conApi = modo === 'api';

  /** Ejecuta una operación en el servidor; ante un error lo deja en `errorOperacion`. */
  const ejecutar = useCallback(
    async (operacion) => {
      setErrorOperacion(null);
      try {
        return await operacion();
      } catch (error) {
        setErrorOperacion(error.message);
        if (error.status === 401) cerrarSesion();
        return null;
      }
    },
    [cerrarSesion],
  );

  const guardarEn = useCallback((coleccion, item) => {
    setDatos((actual) => ({ ...actual, [coleccion]: reemplazarPorId(actual[coleccion], item) }));
    return item;
  }, []);

  /* ------------------------------- Candidatos ------------------------------ */

  const agregarCandidato = useCallback(
    async (nuevo) => {
      if (conApi) {
        return ejecutar(async () => guardarEn('candidatos', await api.crearCandidato(normalizarCandidato(nuevo))));
      }
      const candidato = { id: generarId(datosRef.current.candidatos), ...normalizarCandidato(nuevo) };
      return guardarEn('candidatos', candidato);
    },
    [conApi, api, ejecutar, guardarEn],
  );

  const actualizarCandidato = useCallback(
    async (id, cambios) => {
      if (conApi) {
        return ejecutar(async () =>
          guardarEn('candidatos', await api.actualizarCandidato(id, normalizarCandidato(cambios))),
        );
      }
      const actual = datosRef.current.candidatos.find((candidato) => candidato.id === Number(id));
      return actual ? guardarEn('candidatos', { ...actual, ...normalizarCandidato(cambios) }) : null;
    },
    [conApi, api, ejecutar, guardarEn],
  );

  const eliminarCandidato = useCallback(
    async (id) => {
      const quitar = () => {
        setDatos((actual) => ({
          ...actual,
          candidatos: actual.candidatos.filter((candidato) => candidato.id !== Number(id)),
        }));
        return true;
      };
      if (conApi) {
        return ejecutar(async () => {
          await api.eliminarCandidato(id);
          return quitar();
        });
      }
      return quitar();
    },
    [conApi, api, ejecutar],
  );

  const obtenerCandidato = useCallback(
    (id) => datos.candidatos.find((candidato) => candidato.id === Number(id)) ?? null,
    [datos.candidatos],
  );

  /* ------------------------------- Solicitudes ----------------------------- */

  const agregarSolicitud = useCallback(
    async (nueva) => {
      const solicitud = {
        candidatoId: Number(nueva.candidatoId),
        cargo: nueva.cargo.trim(),
        familiaCargo: nueva.familiaCargo,
        fechaSolicitud: nueva.fechaSolicitud,
        estado: 'Pendiente',
        etapa: 'recibida',
        reclutador: nueva.reclutador ?? '',
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
      if (conApi) {
        return ejecutar(async () => guardarEn('solicitudes', await api.crearSolicitud(solicitud)));
      }
      return guardarEn('solicitudes', { id: generarId(datosRef.current.solicitudes), ...solicitud });
    },
    [conApi, api, ejecutar, guardarEn],
  );

  /** Cambios locales a una solicitud (en modo API se usan las acciones específicas). */
  const cambiarSolicitudLocal = useCallback(
    (id, cambiar) => {
      const actual = datosRef.current.solicitudes.find((solicitud) => solicitud.id === Number(id));
      return actual ? guardarEn('solicitudes', cambiar(actual)) : null;
    },
    [guardarEn],
  );

  /** Actualiza el estado de una solicitud (lo único que la interfaz cambia directamente). */
  const actualizarSolicitud = useCallback(
    async (id, cambios) => {
      if (conApi) {
        return ejecutar(async () => guardarEn('solicitudes', await api.actualizarSolicitud(id, cambios)));
      }
      return cambiarSolicitudLocal(id, (solicitud) => ({ ...solicitud, ...cambios }));
    },
    [conApi, api, ejecutar, guardarEn, cambiarSolicitudLocal],
  );

  const obtenerSolicitud = useCallback(
    (id) => datos.solicitudes.find((solicitud) => solicitud.id === Number(id)) ?? null,
    [datos.solicitudes],
  );

  /**
   * Mueve una solicitud a otra etapa del Planner y sincroniza su estado oficial.
   * Si se entregan datos de agenda (fecha, hora, modalidad) se guardan con la etapa;
   * al volver a "Evaluación Recibida" la entrevista queda nuevamente por coordinar.
   */
  const moverEtapa = useCallback(
    async (id, etapa, agenda = {}) => {
      if (conApi) {
        return ejecutar(async () => guardarEn('solicitudes', await api.moverEtapa(id, etapa, agenda)));
      }
      return cambiarSolicitudLocal(id, (solicitud) => {
        const datosAgenda =
          etapa === 'recibida'
            ? { fechaEntrevista: '', horaEntrevista: '', modalidadEntrevista: '' }
            : {
                ...(agenda.fechaEntrevista ? { fechaEntrevista: agenda.fechaEntrevista } : {}),
                ...(agenda.horaEntrevista ? { horaEntrevista: agenda.horaEntrevista } : {}),
                ...(agenda.modalidadEntrevista ? { modalidadEntrevista: agenda.modalidadEntrevista } : {}),
              };
        return { ...solicitud, ...datosAgenda, etapa, estado: estadoDeEtapa(etapa) };
      });
    },
    [conApi, api, ejecutar, guardarEn, cambiarSolicitudLocal],
  );

  /** Asigna (o quita, con "") la psicóloga responsable de la solicitud. */
  const asignarProfesional = useCallback(
    async (id, profesional) => {
      if (conApi) {
        return ejecutar(async () =>
          guardarEn('solicitudes', await api.actualizarSolicitud(id, { profesionalResponsable: profesional })),
        );
      }
      return cambiarSolicitudLocal(id, (solicitud) => ({ ...solicitud, profesionalResponsable: profesional }));
    },
    [conApi, api, ejecutar, guardarEn, cambiarSolicitudLocal],
  );

  /* ------------------------------ Evaluaciones ----------------------------- */

  const obtenerEvaluacionDeSolicitud = useCallback(
    (solicitudId) =>
      datos.evaluaciones.find((evaluacion) => evaluacion.solicitudId === Number(solicitudId)) ?? null,
    [datos.evaluaciones],
  );

  /** Registra o actualiza la evaluación de una solicitud y actualiza su estado. */
  const registrarEvaluacion = useCallback(
    async (solicitudId, datosEvaluacion) => {
      const registro = {
        fechaEvaluacion: datosEvaluacion.fechaEvaluacion,
        resultado: datosEvaluacion.resultado,
        observaciones: datosEvaluacion.observaciones.trim(),
        estado: ESTADOS_EVALUACION.includes(datosEvaluacion.estado) ? datosEvaluacion.estado : 'Realizada',
      };
      const existente = datosRef.current.evaluaciones.find(
        (evaluacion) => evaluacion.solicitudId === Number(solicitudId),
      );

      const aplicar = (evaluacion) => {
        setDatos((actual) => ({
          ...actual,
          evaluaciones: reemplazarPorId(actual.evaluaciones, evaluacion),
          solicitudes: actual.solicitudes.map((solicitud) =>
            solicitud.id === Number(solicitudId)
              ? { ...solicitud, estado: estadoSolicitudDesdeEvaluacion(evaluacion) }
              : solicitud,
          ),
        }));
        return registro;
      };

      if (conApi) {
        return ejecutar(async () =>
          aplicar({ ...registro, ...(await api.guardarEvaluacion(Number(solicitudId), registro, existente?.id)) }),
        );
      }
      return aplicar(
        existente
          ? { ...existente, ...registro }
          : { id: generarId(datosRef.current.evaluaciones), solicitudId: Number(solicitudId), ...registro },
      );
    },
    [conApi, api, ejecutar],
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
   * Devuelve { postulacion, candidato } (en modo API el candidato no se expone).
   */
  const postular = useCallback(
    async (ofertaId, datosPostulante) => {
      const oferta = datosRef.current.ofertas.find((item) => item.id === Number(ofertaId));
      if (!oferta) throw new Error('La oferta no existe o ya no está disponible.');

      if (conApi) {
        return ejecutar(async () => ({
          postulacion: await api.postular(oferta.id, { ...datosPostulante, consentimiento: true }),
          candidato: null,
        }));
      }

      const { candidatos, postulaciones } = datosRef.current;
      const correo = datosPostulante.correo.trim().toLowerCase();
      const existente = candidatos.find((candidato) => candidato.correo === correo);
      const candidato = existente ?? {
        id: generarId(candidatos),
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
        id: generarId(postulaciones),
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
    [conApi, api, ejecutar],
  );

  const actualizarPostulacion = useCallback(
    async (id, cambios) => {
      if (conApi) {
        return ejecutar(async () => guardarEn('postulaciones', await api.actualizarPostulacion(id, cambios)));
      }
      const actual = datosRef.current.postulaciones.find((postulacion) => postulacion.id === Number(id));
      return actual ? guardarEn('postulaciones', { ...actual, ...cambios }) : null;
    },
    [conApi, api, ejecutar, guardarEn],
  );

  /** Restaura los datos de demostración (en modo API, también la base de datos). */
  const reiniciarDatos = useCallback(async () => {
    if (conApi) {
      const resultado = await ejecutar(() => api.reiniciar());
      if (resultado) await cargar();
      return resultado;
    }
    setDatos(obtenerSemilla());
    return true;
  }, [conApi, api, ejecutar, cargar]);

  const limpiarError = useCallback(() => setErrorOperacion(null), []);

  const valor = useMemo(
    () => ({
      candidatos: datos.candidatos,
      solicitudes: datos.solicitudes,
      evaluaciones: datos.evaluaciones,
      ofertas: datos.ofertas,
      postulaciones: datos.postulaciones,
      modo,
      cargando,
      errorOperacion,
      limpiarError,
      recargar: cargar,
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
      modo,
      cargando,
      errorOperacion,
      limpiarError,
      cargar,
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
