import { describe, expect, it } from 'vitest';
import { formatearDuracion, formatearTokens, formatearUsd, nombreTarea, porcentajeCuota, rangoMesActual } from './usoIa';

describe('usoIa', () => {
  it('formatea dólares con 4 decimales bajo 1 USD y 2 sobre 1 USD', () => {
    expect(formatearUsd(0.0812)).toBe('USD 0,0812');
    expect(formatearUsd(12.5)).toBe('USD 12,50');
    expect(formatearUsd()).toBe('USD 0,0000');
  });

  it('abrevia tokens en miles y millones', () => {
    expect(formatearTokens(950)).toBe('950');
    expect(formatearTokens(12345)).toBe('12,3 mil');
    expect(formatearTokens(1_250_000)).toBe('1,3 M');
  });

  it('formatea la duración del audio', () => {
    expect(formatearDuracion(42)).toBe('42 s');
    expect(formatearDuracion(120)).toBe('2 min');
    expect(formatearDuracion(200)).toBe('3 min 20 s');
  });

  it('calcula el porcentaje de cuota con tope de 100', () => {
    expect(porcentajeCuota(150, 300)).toBe(50);
    expect(porcentajeCuota(400, 300)).toBe(100);
    expect(porcentajeCuota(10, 0)).toBe(0);
  });

  it('traduce el nombre de cada ayuda y deja igual las desconocidas', () => {
    expect(nombreTarea('borradorEvaluacion')).toBe('Borrador de evaluación');
    expect(nombreTarea('otra')).toBe('otra');
  });

  it('el rango por defecto va del primer día del mes a hoy', () => {
    expect(rangoMesActual(new Date(2026, 10, 12))).toEqual({ desde: '2026-11-01', hasta: '2026-11-12' });
  });
});
