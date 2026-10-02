import { describe, expect, it } from 'vitest';
import {
  etiquetaMes,
  filtrarRegistros,
  mesesDisponibles,
  porCategoria,
  porFamiliaYTipo,
  porMesYTipo,
  porReclutador,
  promedioTiming,
  registrosEvaluados,
} from './indicadoresEvaluacion';

const solicitudes = [
  { id: 1, familiaCargo: 'Técnico B C', profesionalResponsable: 'Carolina Muñoz', tipoEvaluacion: 'externa' },
  { id: 2, familiaCargo: 'Técnico B C', profesionalResponsable: 'Javiera Soto', tipoEvaluacion: 'interna' },
  { id: 3, familiaCargo: 'Jefatura', profesionalResponsable: 'Carolina Muñoz', tipoEvaluacion: 'interna' },
  { id: 4, familiaCargo: 'Jefatura', profesionalResponsable: 'Javiera Soto', tipoEvaluacion: 'externa' },
];

const evaluaciones = [
  { solicitudId: 1, resultado: 'Recomendado', fechaEvaluacion: '2026-03-04', diasRespuesta: 2 },
  { solicitudId: 2, resultado: 'No recomendado', fechaEvaluacion: '2026-03-20', diasRespuesta: 4 },
  { solicitudId: 3, resultado: 'Recomendado', fechaEvaluacion: '2026-04-02', diasRespuesta: 6 },
  { solicitudId: 4, resultado: '', fechaEvaluacion: '2026-04-10' },
];

const registros = registrosEvaluados(solicitudes, evaluaciones);

describe('indicadores de evaluación', () => {
  it('considera solo evaluaciones con resultado y las une con su solicitud', () => {
    expect(registros).toHaveLength(3);
    expect(registros[0]).toEqual({
      resultado: 'Recomendado',
      tipo: 'externa',
      familia: 'Técnico B C',
      reclutador: 'Carolina Muñoz',
      mes: '2026-03',
      diasRespuesta: 2,
    });
  });

  it('cuenta por categoría en orden fijo con porcentaje', () => {
    expect(porCategoria(registros)).toEqual([
      { etiqueta: 'Recomendado', total: 2, porcentaje: 67 },
      { etiqueta: 'Recomendado con observaciones', total: 0, porcentaje: 0 },
      { etiqueta: 'No recomendado', total: 1, porcentaje: 33 },
    ]);
  });

  it('separa familia de cargo y mes por tipo de evaluación', () => {
    expect(porFamiliaYTipo(registros)).toEqual([
      { etiqueta: 'Técnico B C', externa: 1, interna: 1, total: 2 },
      { etiqueta: 'Jefatura', externa: 0, interna: 1, total: 1 },
    ]);
    expect(porMesYTipo(registros).map((fila) => [fila.etiqueta, fila.total])).toEqual([
      ['2026-03', 2],
      ['2026-04', 1],
    ]);
  });

  it('cuenta por reclutador y calcula el timing promedio', () => {
    expect(porReclutador(registros)).toEqual([
      { etiqueta: 'Carolina Muñoz', total: 2 },
      { etiqueta: 'Javiera Soto', total: 1 },
    ]);
    expect(promedioTiming(registros)).toBe(4);
  });

  it('filtra por mes y por tipo de evaluación', () => {
    expect(filtrarRegistros(registros, { mes: '2026-03' })).toHaveLength(2);
    expect(filtrarRegistros(registros, { tipo: 'interna' })).toHaveLength(2);
    expect(filtrarRegistros(registros, { mes: '2026-03', tipo: 'interna' })).toHaveLength(1);
    expect(filtrarRegistros(registros, {})).toHaveLength(3);
  });

  it('lista los meses disponibles y su etiqueta', () => {
    expect(mesesDisponibles(registros)).toEqual(['2026-03', '2026-04']);
    expect(etiquetaMes('2026-03')).toBe('mar 2026');
  });
});
