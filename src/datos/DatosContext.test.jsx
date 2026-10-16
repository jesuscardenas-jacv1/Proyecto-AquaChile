import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProveedorDatos, useDatos } from './DatosContext';
import { ProveedorAuth } from './AuthContext';
import { CLAVE_ALMACEN, obtenerSemilla } from './almacen';
import { crearServicioMemoria } from '../servicios/servicioMemoria';
import { ErrorApi } from '../servicios/errores';
import { crearWrapper, datosDemo, USUARIO_TEST_DEFAULT } from '../pruebas/utilidades';

const nuevoCandidato = {
  nombre: 'Ana Torres',
  correo: 'ana@correo.cl',
  telefono: '+56911112222',
  cargo: 'Operario',
  familiaCargo: 'Técnico B C',
};

/** datosDemo con las solicitudes 3 y 4 ya tomadas por la psicóloga (En proceso). */
function demoEnProceso() {
  const datos = structuredClone(datosDemo);
  datos.solicitudes = datos.solicitudes.map((solicitud) =>
    [3, 4].includes(solicitud.id) ? { ...solicitud, estado: 'En proceso' } : solicitud,
  );
  return datos;
}

const renderDatos = (datos = structuredClone(datosDemo)) =>
  renderHook(() => useDatos(), { wrapper: crearWrapper(datos) });

describe('DatosContext', () => {
  it('carga los datos semilla cuando no hay almacenamiento previo', () => {
    const { result } = renderDatos(obtenerSemilla());
    expect(result.current.candidatos.length).toBeGreaterThan(0);
    expect(result.current.solicitudes.length).toBeGreaterThan(0);
    expect(result.current.cargando).toBe(false);
  });

  it('registra un candidato con id correlativo y datos normalizados', async () => {
    const { result } = renderDatos();

    let creado;
    await act(async () => {
      creado = await result.current.agregarCandidato({
        nombre: '  Ana Torres  ',
        correo: 'ANA.Torres@Correo.CL',
        telefono: ' +56911112222 ',
        cargo: ' Operario ',
        familiaCargo: 'Técnico B C',
      });
    });

    const nuevo = result.current.candidatos.at(-1);
    expect(nuevo).toEqual(creado);
    expect(nuevo.nombre).toBe('Ana Torres');
    expect(nuevo.correo).toBe('ana.torres@correo.cl');
    expect(nuevo.id).toBe(5);
  });

  it('en modo demo persiste los cambios en localStorage', async () => {
    const servicio = crearServicioMemoria(structuredClone(datosDemo), { persistir: true });
    const { result } = renderHook(() => useDatos(), {
      wrapper: ({ children }) => <ProveedorDatos servicio={servicio}>{children}</ProveedorDatos>,
    });

    await act(async () => {
      await result.current.agregarCandidato(nuevoCandidato);
    });

    const guardado = JSON.parse(window.localStorage.getItem(CLAVE_ALMACEN));
    expect(guardado.candidatos).toHaveLength(5);
  });

  it('actualiza un candidato existente', async () => {
    const { result } = renderDatos();

    await act(async () => {
      await result.current.actualizarCandidato(1, {
        nombre: 'María González Soto',
        correo: 'maria@correo.cl',
        telefono: '+56912345678',
        cargo: 'Técnico',
        familiaCargo: 'Técnico B C',
      });
    });

    expect(result.current.obtenerCandidato(1).nombre).toBe('María González Soto');
    expect(result.current.candidatos).toHaveLength(4);
  });

  it('elimina un candidato sin solicitudes', async () => {
    const { result } = renderDatos({ ...structuredClone(datosDemo), solicitudes: [], evaluaciones: [] });

    await act(async () => {
      await result.current.eliminarCandidato(1);
    });

    expect(result.current.obtenerCandidato(1)).toBeNull();
  });

  it('no elimina un candidato que tiene solicitudes asociadas (ErrorApi 409)', async () => {
    const { result } = renderDatos();

    let error;
    await act(async () => {
      error = await result.current.eliminarCandidato(1).catch((e) => e);
    });

    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.status).toBe(409);
    expect(error.message).toMatch(/solicitud/);
    expect(result.current.obtenerCandidato(1)).not.toBeNull();
  });

  it('crea una solicitud en estado Pendiente, etapa recibida, y la recupera por id', async () => {
    const { result } = renderDatos();

    let creada;
    await act(async () => {
      creada = await result.current.agregarSolicitud({
        candidatoId: 1,
        cargo: 'Técnico de Planta',
        familiaCargo: 'Técnico B C',
        fechaSolicitud: '2026-09-10',
        observaciones: '  Nota  ',
      });
    });

    expect(creada).toMatchObject({ id: 5, estado: 'Pendiente', etapa: 'recibida' });
    expect(result.current.obtenerSolicitud(5).observaciones).toBe('Nota');
    expect(result.current.obtenerSolicitud(99)).toBeNull();
  });

  it('asigna el profesional responsable', async () => {
    const { result } = renderDatos();

    await act(async () => {
      await result.current.asignarProfesional(3, 'Javiera Soto');
    });

    expect(result.current.obtenerSolicitud(3).profesionalResponsable).toBe('Javiera Soto');
  });

  it('no finaliza una solicitud sin evaluación', async () => {
    const { result } = renderDatos();

    let error;
    await act(async () => {
      error = await result.current.actualizarSolicitud(3, { estado: 'Finalizada' }).catch((e) => e);
    });

    expect(error.status).toBe(409);
    expect(result.current.obtenerSolicitud(3).estado).toBe('Pendiente');
  });

  it('registra la evaluación, finaliza la solicitud y calcula los días de respuesta', async () => {
    const { result } = renderDatos(demoEnProceso());

    await act(async () => {
      await result.current.registrarEvaluacion(3, {
        fechaEvaluacion: '2026-09-12',
        resultado: 'Recomendado',
        observaciones: 'Cumple con el perfil requerido.',
      });
    });

    expect(result.current.obtenerEvaluacionDeSolicitud(3).resultado).toBe('Recomendado');
    expect(result.current.obtenerSolicitud(3).estado).toBe('Finalizada');
    // Días corridos desde la solicitud (2026-08-24) hasta la evaluación (2026-09-12)
    expect(result.current.obtenerEvaluacionDeSolicitud(3).diasRespuesta).toBe(19);
  });

  it('no registra la evaluación de una solicitud Pendiente', async () => {
    const { result } = renderDatos();

    let error;
    await act(async () => {
      error = await result.current
        .registrarEvaluacion(3, {
          fechaEvaluacion: '2026-09-12',
          resultado: 'Recomendado',
          observaciones: 'Cumple con el perfil requerido.',
        })
        .catch((e) => e);
    });

    expect(error.status).toBe(409);
    expect(result.current.obtenerEvaluacionDeSolicitud(3)).toBeNull();
  });

  it('actualiza la evaluación existente en lugar de duplicarla', async () => {
    const { result } = renderDatos();

    await act(async () => {
      await result.current.registrarEvaluacion(1, {
        fechaEvaluacion: '2026-08-15',
        resultado: 'Recomendado con observaciones',
        observaciones: 'Se requiere una segunda entrevista.',
      });
    });

    expect(result.current.evaluaciones).toHaveLength(1);
    expect(result.current.obtenerEvaluacionDeSolicitud(1).resultado).toBe('Recomendado con observaciones');
  });

  it('deja la solicitud en proceso si el registro no tiene resultado', async () => {
    const { result } = renderDatos(demoEnProceso());

    await act(async () => {
      await result.current.registrarEvaluacion(4, {
        fechaEvaluacion: '2026-09-12',
        resultado: '',
        observaciones: 'Evaluación en curso.',
      });
    });

    expect(result.current.obtenerSolicitud(4).estado).toBe('En proceso');
  });

  it('restaura los datos semilla', async () => {
    const totalSemilla = obtenerSemilla().candidatos.length;
    const { result } = renderHook(() => useDatos(), { wrapper: crearWrapper() });

    await act(async () => {
      await result.current.agregarCandidato({ ...nuevoCandidato, correo: 'temporal@correo.cl' });
    });
    expect(result.current.candidatos).toHaveLength(totalSemilla + 1);

    await act(async () => {
      await result.current.reiniciarDatos();
    });
    expect(result.current.candidatos).toHaveLength(totalSemilla);
  });

  it('mueve una solicitud por las etapas del Planner sincronizando el estado', async () => {
    const { result } = renderDatos();
    const agenda = { fechaEntrevista: '2026-09-05', horaEntrevista: '10:00', modalidadEntrevista: 'Teams' };

    await act(async () => {
      await result.current.moverEtapa(3, 'agendada', agenda);
    });
    expect(result.current.obtenerSolicitud(3)).toMatchObject({ ...agenda, etapa: 'agendada', estado: 'En proceso' });

    await act(async () => {
      await result.current.moverEtapa(3, 'realizada');
    });
    expect(result.current.obtenerSolicitud(3)).toMatchObject({ etapa: 'realizada', fechaEntrevista: '2026-09-05' });

    await act(async () => {
      await result.current.moverEtapa(3, 'recibida');
    });
    expect(result.current.obtenerSolicitud(3)).toMatchObject({
      etapa: 'recibida',
      estado: 'Pendiente',
      fechaEntrevista: '',
      horaEntrevista: '',
    });
  });

  it('falla si el hook se usa fuera del proveedor', () => {
    expect(() => renderHook(() => useDatos())).toThrowError(
      /debe usarse dentro de un <ProveedorDatos>/,
    );
  });
});

/* ----------------------- Servicio remoto (como la API) ---------------------- */

/** Servicio que imita a servicioApi: sin datos locales, todo llega por promesas. */
function crearServicioRemoto(sobrescribir = {}) {
  const memoria = crearServicioMemoria(structuredClone(datosDemo));
  const { obtenerInstantanea, ...remoto } = memoria;
  return { ...remoto, modo: 'api', cargarDatos: vi.fn(() => memoria.cargarDatos()), ...sobrescribir };
}

const wrapperRemoto = (servicio, usuario) =>
  function Wrapper({ children }) {
    return (
      <ProveedorAuth usuarioInicial={usuario} servicio={servicio}>
        <ProveedorDatos servicio={servicio}>{children}</ProveedorDatos>
      </ProveedorAuth>
    );
  };

describe('DatosContext con un servicio remoto (API)', () => {
  it('no pide datos sin sesión iniciada', () => {
    const servicio = crearServicioRemoto();
    const { result } = renderHook(() => useDatos(), { wrapper: wrapperRemoto(servicio, null) });

    expect(servicio.cargarDatos).not.toHaveBeenCalled();
    expect(result.current.candidatos).toEqual([]);
    expect(result.current.cargando).toBe(false);
  });

  it('carga los datos al haber sesión y muestra el estado de carga', async () => {
    const servicio = crearServicioRemoto();
    const { result } = renderHook(() => useDatos(), {
      wrapper: wrapperRemoto(servicio, USUARIO_TEST_DEFAULT),
    });

    expect(result.current.cargando).toBe(true);
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(servicio.cargarDatos).toHaveBeenCalledTimes(1);
    expect(result.current.candidatos).toHaveLength(4);
    expect(result.current.modo).toBe('api');
  });

  it('informa el error de carga y permite reintentar', async () => {
    const servicio = crearServicioRemoto();
    const cargaReal = servicio.cargarDatos;
    servicio.cargarDatos = vi
      .fn()
      .mockRejectedValueOnce(new ErrorApi(0, 'No se pudo conectar con el servidor.'))
      .mockImplementation(cargaReal);

    const { result } = renderHook(() => useDatos(), {
      wrapper: wrapperRemoto(servicio, USUARIO_TEST_DEFAULT),
    });

    await waitFor(() => expect(result.current.errorCarga).not.toBeNull());
    expect(result.current.errorCarga.message).toMatch(/conectar/);

    await act(async () => {
      await result.current.recargar();
    });
    expect(result.current.errorCarga).toBeNull();
    expect(result.current.solicitudes).toHaveLength(4);
  });

  it('pasa la evaluación existente al servicio para que la actualice (PUT) en vez de crearla', async () => {
    const servicio = crearServicioRemoto();
    const registrar = vi.spyOn(servicio, 'registrarEvaluacion');
    const { result } = renderHook(() => useDatos(), {
      wrapper: wrapperRemoto(servicio, USUARIO_TEST_DEFAULT),
    });
    await waitFor(() => expect(result.current.cargando).toBe(false));

    const datosEvaluacion = {
      fechaEvaluacion: '2026-08-15',
      resultado: 'No recomendado',
      observaciones: 'Cambio de dictamen tras revisión.',
    };
    await act(async () => {
      await result.current.registrarEvaluacion(1, datosEvaluacion);
    });

    expect(registrar).toHaveBeenCalledWith(
      1,
      datosEvaluacion,
      expect.objectContaining({ id: 1, solicitudId: 1 }),
    );
    expect(result.current.obtenerEvaluacionDeSolicitud(1).resultado).toBe('No recomendado');
  });
});
