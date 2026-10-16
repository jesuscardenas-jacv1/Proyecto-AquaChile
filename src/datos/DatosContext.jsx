import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { obtenerSemilla } from './almacen';
import { ContextoAuth } from './AuthContext';
import { crearServicioPorDefecto } from '../servicios/configuracion';
import { crearServicioMemoria } from '../servicios/servicioMemoria';

const ContextoDatos = createContext(null);

const DATOS_VACIOS = { candidatos: [], solicitudes: [], evaluaciones: [] };

const reemplazarPorId = (lista, actualizado) =>
  lista.map((item) => (item.id === actualizado.id ? actualizado : item));

const agregarOReemplazar = (lista, item) =>
  lista.some((actual) => actual.id === item.id)
    ? reemplazarPorId(lista, item)
    : [...lista, item];

/**
 * Proveedor de datos de la aplicación (candidatos, solicitudes y evaluaciones).
 *
 * Delega cada operación en un "servicio" de datos:
 * - servicioApi: la API REST del backend (modo por defecto). Los datos se cargan al
 *   iniciar sesión y se vuelven a cargar si cambia el usuario (cada rol recibe lo suyo).
 * - servicioMemoria: datos locales (pruebas y modo demo de GitHub Pages).
 *
 * Las acciones son asíncronas: devuelven una promesa y, si la operación falla,
 * lanzan un ErrorApi que cada pantalla muestra al usuario.
 *
 * @param {object} props
 * @param {object} [props.datosIniciales] datos para un servicio en memoria (pruebas)
 * @param {object} [props.servicio]       servicio de datos explícito
 */
export function ProveedorDatos({ children, datosIniciales, servicio: servicioExterno }) {
  const auth = useContext(ContextoAuth);
  const idUsuario = auth?.usuarioActual?.id ?? null;

  const [servicio] = useState(
    () =>
      servicioExterno ??
      (datosIniciales ? crearServicioMemoria(datosIniciales) : crearServicioPorDefecto()),
  );
  // El servicio en memoria entrega sus datos de inmediato; la API se consulta al iniciar sesión.
  const esLocal = typeof servicio.obtenerInstantanea === 'function';

  const [datos, setDatos] = useState(() =>
    esLocal ? servicio.obtenerInstantanea() : DATOS_VACIOS,
  );
  const [estadoCarga, setEstadoCarga] = useState(esLocal ? 'listo' : 'inactivo');
  const [errorCarga, setErrorCarga] = useState(null);

  // Referencia a los datos más recientes para las acciones (evita cierres desactualizados)
  const datosRef = useRef(datos);
  datosRef.current = datos;
  // Identifica la última carga para descartar respuestas de cargas anteriores
  const cargaActual = useRef(0);

  const recargar = useCallback(async () => {
    const numero = ++cargaActual.current;
    setEstadoCarga('cargando');
    setErrorCarga(null);
    try {
      const nuevos = await servicio.cargarDatos();
      if (numero !== cargaActual.current) return;
      setDatos(nuevos);
      setEstadoCarga('listo');
    } catch (error) {
      if (numero !== cargaActual.current) return;
      setErrorCarga(error);
      setEstadoCarga('error');
    }
  }, [servicio]);

  useEffect(() => {
    if (esLocal) return;
    if (!idUsuario) {
      // Sin sesión no se muestran datos de nadie
      cargaActual.current += 1;
      setDatos(DATOS_VACIOS);
      setEstadoCarga('inactivo');
      return;
    }
    recargar();
  }, [esLocal, idUsuario, recargar]);

  /* ------------------------------- Candidatos ------------------------------ */

  const agregarCandidato = useCallback(
    async (nuevo) => {
      const candidato = await servicio.crearCandidato(nuevo);
      setDatos((actual) => ({ ...actual, candidatos: [...actual.candidatos, candidato] }));
      return candidato;
    },
    [servicio],
  );

  const actualizarCandidato = useCallback(
    async (id, cambios) => {
      const candidato = await servicio.actualizarCandidato(Number(id), cambios);
      setDatos((actual) => ({
        ...actual,
        candidatos: reemplazarPorId(actual.candidatos, candidato),
      }));
      return candidato;
    },
    [servicio],
  );

  /** Solo se elimina si no tiene solicitudes asociadas (si no, lanza ErrorApi 409). */
  const eliminarCandidato = useCallback(
    async (id) => {
      await servicio.eliminarCandidato(Number(id));
      setDatos((actual) => ({
        ...actual,
        candidatos: actual.candidatos.filter((candidato) => candidato.id !== Number(id)),
      }));
    },
    [servicio],
  );

  const obtenerCandidato = useCallback(
    (id) => datos.candidatos.find((candidato) => candidato.id === Number(id)) ?? null,
    [datos.candidatos],
  );

  /* ------------------------------- Solicitudes ----------------------------- */

  const agregarSolicitud = useCallback(
    async (nueva) => {
      const solicitud = await servicio.crearSolicitud(nueva);
      setDatos((actual) => ({ ...actual, solicitudes: [...actual.solicitudes, solicitud] }));
      return solicitud;
    },
    [servicio],
  );

  const aplicarSolicitud = useCallback((solicitud) => {
    setDatos((actual) => ({
      ...actual,
      solicitudes: reemplazarPorId(actual.solicitudes, solicitud),
    }));
    return solicitud;
  }, []);

  /** Cambia el estado y/o el profesional responsable de una solicitud. */
  const actualizarSolicitud = useCallback(
    async (id, cambios) => aplicarSolicitud(await servicio.actualizarSolicitud(Number(id), cambios)),
    [servicio, aplicarSolicitud],
  );

  const asignarProfesional = useCallback(
    (id, profesional) => actualizarSolicitud(id, { profesionalResponsable: profesional }),
    [actualizarSolicitud],
  );

  /**
   * Mueve una solicitud a otra etapa del Planner (sincroniza su estado oficial).
   * Si se entregan datos de agenda (fecha, hora, modalidad) se guardan con la etapa.
   */
  const moverEtapa = useCallback(
    async (id, etapa, agenda = {}) =>
      aplicarSolicitud(await servicio.moverEtapa(Number(id), etapa, agenda)),
    [servicio, aplicarSolicitud],
  );

  const obtenerSolicitud = useCallback(
    (id) => datos.solicitudes.find((solicitud) => solicitud.id === Number(id)) ?? null,
    [datos.solicitudes],
  );

  /* ------------------------------ Evaluaciones ----------------------------- */

  const obtenerEvaluacionDeSolicitud = useCallback(
    (solicitudId) =>
      datos.evaluaciones.find((evaluacion) => evaluacion.solicitudId === Number(solicitudId)) ??
      null,
    [datos.evaluaciones],
  );

  /** Registra o actualiza la evaluación de una solicitud (y su estado). */
  const registrarEvaluacion = useCallback(
    async (solicitudId, datosEvaluacion) => {
      const existente =
        datosRef.current.evaluaciones.find(
          (evaluacion) => evaluacion.solicitudId === Number(solicitudId),
        ) ?? null;
      const { evaluacion, solicitud } = await servicio.registrarEvaluacion(
        Number(solicitudId),
        datosEvaluacion,
        existente,
      );
      setDatos((actual) => ({
        ...actual,
        evaluaciones: agregarOReemplazar(actual.evaluaciones, evaluacion),
        solicitudes: reemplazarPorId(actual.solicitudes, solicitud),
      }));
      return evaluacion;
    },
    [servicio],
  );

  /** Restaura los datos semilla (solo en modo memoria: demos y pruebas). */
  const reiniciarDatos = useCallback(async () => {
    if (typeof servicio.reiniciar !== 'function') return;
    setDatos(await servicio.reiniciar(obtenerSemilla()));
  }, [servicio]);

  const valor = useMemo(
    () => ({
      candidatos: datos.candidatos,
      solicitudes: datos.solicitudes,
      evaluaciones: datos.evaluaciones,
      cargando: estadoCarga === 'cargando',
      errorCarga,
      modo: servicio.modo,
      recargar,
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
      estadoCarga,
      errorCarga,
      servicio.modo,
      recargar,
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
