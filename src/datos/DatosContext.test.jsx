import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDatos } from './DatosContext';
import { CLAVE_ALMACEN, obtenerSemilla } from './almacen';
import { crearWrapper } from '../pruebas/utilidades';

describe('DatosContext', () => {
  it('carga los datos semilla cuando no hay almacenamiento previo', () => {
    const { result } = renderHook(() => useDatos(), { wrapper: crearWrapper(obtenerSemilla()) });
    expect(result.current.candidatos.length).toBeGreaterThan(0);
    expect(result.current.solicitudes.length).toBeGreaterThan(0);
  });

  it('registra un candidato con id correlativo y datos normalizados', () => {
    const { result } = renderHook(() => useDatos(), { wrapper: crearWrapper() });

    act(() => {
      result.current.agregarCandidato({
        nombre: '  Ana Torres  ',
        correo: 'ANA.Torres@Correo.CL',
        telefono: ' +56911112222 ',
        cargo: ' Operario ',
        familiaCargo: 'Operaciones',
      });
    });

    const nuevo = result.current.candidatos.at(-1);
    expect(nuevo.nombre).toBe('Ana Torres');
    expect(nuevo.correo).toBe('ana.torres@correo.cl');
    expect(nuevo.id).toBe(5);
  });

  it('persiste los cambios en localStorage', () => {
    const { result } = renderHook(() => useDatos(), { wrapper: crearWrapper() });

    act(() => {
      result.current.agregarCandidato({
        nombre: 'Ana Torres',
        correo: 'ana@correo.cl',
        telefono: '+56911112222',
        cargo: 'Operario',
        familiaCargo: 'Operaciones',
      });
    });

    const guardado = JSON.parse(window.localStorage.getItem(CLAVE_ALMACEN));
    expect(guardado.candidatos).toHaveLength(5);
  });

  it('actualiza un candidato existente', () => {
    const { result } = renderHook(() => useDatos(), { wrapper: crearWrapper() });

    act(() => {
      result.current.actualizarCandidato(1, {
        nombre: 'María González Soto',
        correo: 'maria@correo.cl',
        telefono: '+56912345678',
        cargo: 'Técnico',
        familiaCargo: 'Operaciones',
      });
    });

    expect(result.current.obtenerCandidato(1).nombre).toBe('María González Soto');
    expect(result.current.candidatos).toHaveLength(4);
  });

  it('elimina un candidato', () => {
    const { result } = renderHook(() => useDatos(), { wrapper: crearWrapper() });

    act(() => {
      result.current.eliminarCandidato(1);
    });

    expect(result.current.obtenerCandidato(1)).toBeNull();
  });

  it('crea una solicitud en estado Pendiente y la recupera por id', () => {
    const { result } = renderHook(() => useDatos(), { wrapper: crearWrapper() });

    act(() => {
      result.current.agregarSolicitud({
        candidatoId: 1,
        cargo: 'Técnico de Planta',
        familiaCargo: 'Operaciones',
        fechaSolicitud: '2026-09-10',
        observaciones: '  Nota  ',
      });
    });

    const solicitud = result.current.obtenerSolicitud(5);
    expect(solicitud.estado).toBe('Pendiente');
    expect(solicitud.observaciones).toBe('Nota');
    expect(result.current.obtenerSolicitud(99)).toBeNull();
  });

  it('asigna el profesional responsable', () => {
    const { result } = renderHook(() => useDatos(), { wrapper: crearWrapper() });

    act(() => {
      result.current.asignarProfesional(3, 'Javiera Soto');
    });

    expect(result.current.obtenerSolicitud(3).profesionalResponsable).toBe('Javiera Soto');
  });

  it('registra la evaluación y finaliza la solicitud', () => {
    const { result } = renderHook(() => useDatos(), { wrapper: crearWrapper() });

    act(() => {
      result.current.registrarEvaluacion(3, {
        fechaEvaluacion: '2026-09-12',
        resultado: 'Aprobado',
        observaciones: 'Cumple con el perfil requerido.',
      });
    });

    expect(result.current.obtenerEvaluacionDeSolicitud(3).resultado).toBe('Aprobado');
    expect(result.current.obtenerSolicitud(3).estado).toBe('Finalizada');
  });

  it('actualiza la evaluación existente en lugar de duplicarla', () => {
    const { result } = renderHook(() => useDatos(), { wrapper: crearWrapper() });

    act(() => {
      result.current.registrarEvaluacion(1, {
        fechaEvaluacion: '2026-08-15',
        resultado: 'No concluyente',
        observaciones: 'Se requiere una segunda entrevista.',
      });
    });

    expect(result.current.evaluaciones).toHaveLength(1);
    expect(result.current.obtenerEvaluacionDeSolicitud(1).resultado).toBe('No concluyente');
  });

  it('deja la solicitud en proceso si el registro no tiene resultado', () => {
    const { result } = renderHook(() => useDatos(), { wrapper: crearWrapper() });

    act(() => {
      result.current.registrarEvaluacion(4, {
        fechaEvaluacion: '2026-09-12',
        resultado: '',
        observaciones: 'Evaluación en curso.',
      });
    });

    expect(result.current.obtenerSolicitud(4).estado).toBe('En proceso');
  });

  it('restaura los datos semilla', () => {
    const { result } = renderHook(() => useDatos(), { wrapper: crearWrapper() });

    act(() => {
      result.current.eliminarCandidato(1);
    });
    expect(result.current.candidatos).toHaveLength(3);

    act(() => {
      result.current.reiniciarDatos();
    });
    expect(result.current.candidatos).toHaveLength(4);
  });

  it('falla si el hook se usa fuera del proveedor', () => {
    expect(() => renderHook(() => useDatos())).toThrowError(
      /debe usarse dentro de un <ProveedorDatos>/,
    );
  });
});
