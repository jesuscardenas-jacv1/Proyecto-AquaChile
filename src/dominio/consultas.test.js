import { describe, expect, it } from 'vitest';
import { filtrarCandidatos, filtrarSolicitudes, ordenarPorFecha } from './consultas';
import {
  estadoSolicitudDesdeEvaluacion,
  resumenSolicitudes,
  solicitudesPorFamilia,
  solicitudesRecientes,
} from './indicadores';

const candidatos = [
  { id: 1, nombre: 'María González', correo: 'maria@correo.cl', cargo: 'Técnico', familiaCargo: 'Técnico B C' },
  { id: 2, nombre: 'Juan Pérez', correo: 'juan@correo.cl', cargo: 'Analista', familiaCargo: 'Profesional A' },
];

const solicitudes = [
  { id: 1, candidatoId: 1, cargo: 'Técnico', familiaCargo: 'Técnico B C', fechaSolicitud: '2026-08-03', estado: 'Finalizada', profesionalResponsable: 'Carolina Muñoz', observaciones: '' },
  { id: 2, candidatoId: 2, cargo: 'Analista', familiaCargo: 'Profesional A', fechaSolicitud: '2026-08-17', estado: 'En proceso', profesionalResponsable: '', observaciones: '' },
  { id: 3, candidatoId: 1, cargo: 'Técnico', familiaCargo: 'Técnico B C', fechaSolicitud: '2026-09-01', estado: 'Pendiente', profesionalResponsable: '', observaciones: '' },
];

describe('filtrarSolicitudes', () => {
  it('filtra por texto libre incluyendo el nombre del candidato', () => {
    const resultado = filtrarSolicitudes(solicitudes, { texto: 'juan' }, candidatos);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe(2);
  });

  it('filtra por estado y familia de cargo', () => {
    expect(filtrarSolicitudes(solicitudes, { estado: 'Pendiente' }, candidatos)).toHaveLength(1);
    expect(
      filtrarSolicitudes(solicitudes, { familiaCargo: 'Técnico B C' }, candidatos),
    ).toHaveLength(2);
  });

  it('devuelve todas cuando no hay criterios', () => {
    expect(filtrarSolicitudes(solicitudes, {}, candidatos)).toHaveLength(3);
  });
});

describe('filtrarCandidatos', () => {
  it('busca sin distinguir mayúsculas ni tildes', () => {
    expect(filtrarCandidatos(candidatos, 'MARIA')).toHaveLength(1);
    expect(filtrarCandidatos(candidatos, 'ANALISTA')).toHaveLength(1);
  });

  it('devuelve la lista completa si la búsqueda está vacía', () => {
    expect(filtrarCandidatos(candidatos, '')).toHaveLength(2);
  });
});

describe('indicadores', () => {
  it('calcula el resumen por estado y el porcentaje de finalizadas', () => {
    const resumen = resumenSolicitudes(solicitudes);
    expect(resumen.total).toBe(3);
    expect(resumen.porEstado).toEqual({ Pendiente: 1, 'En proceso': 1, Finalizada: 1 });
    expect(resumen.porcentajeFinalizadas).toBe(33);
  });

  it('devuelve 0% cuando no hay solicitudes', () => {
    expect(resumenSolicitudes([]).porcentajeFinalizadas).toBe(0);
  });

  it('agrupa por familia de cargo de mayor a menor', () => {
    expect(solicitudesPorFamilia(solicitudes)).toEqual([
      { familia: 'Técnico B C', total: 2 },
      { familia: 'Profesional A', total: 1 },
    ]);
  });

  it('ordena por fecha descendente', () => {
    expect(ordenarPorFecha(solicitudes).map((s) => s.id)).toEqual([3, 2, 1]);
    expect(solicitudesRecientes(solicitudes, 2).map((s) => s.id)).toEqual([3, 2]);
  });

  it('finaliza la solicitud cuando la evaluación tiene resultado', () => {
    expect(estadoSolicitudDesdeEvaluacion({ resultado: 'Recomendado' })).toBe('Finalizada');
    expect(estadoSolicitudDesdeEvaluacion({ resultado: '' })).toBe('En proceso');
    expect(estadoSolicitudDesdeEvaluacion(null)).toBe('En proceso');
  });
});
