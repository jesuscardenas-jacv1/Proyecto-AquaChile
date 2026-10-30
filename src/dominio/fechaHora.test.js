import { describe, expect, it } from 'vitest';
import {
  componerFecha,
  componerHora,
  descomponerFecha,
  descomponerHora,
  diasDelMes,
  textoFecha,
} from './fechaHora';

describe('fechaHora', () => {
  it('cuenta los días de cada mes, incluido febrero bisiesto', () => {
    expect(diasDelMes(2026, 10)).toBe(31);
    expect(diasDelMes(2026, 4)).toBe(30);
    expect(diasDelMes(2026, 2)).toBe(28);
    expect(diasDelMes(2028, 2)).toBe(29);
  });

  it('separa y vuelve a armar la fecha ISO', () => {
    expect(descomponerFecha('2026-10-07')).toEqual({ anio: 2026, mes: 10, dia: 7 });
    expect(componerFecha({ anio: 2026, mes: 10, dia: 7 })).toBe('2026-10-07');
    expect(descomponerFecha('7/10/2026')).toBeNull();
  });

  it('ajusta el día al cambiar a un mes más corto', () => {
    expect(componerFecha({ anio: 2026, mes: 2, dia: 31 })).toBe('2026-02-28');
  });

  it('separa y vuelve a armar la hora', () => {
    expect(descomponerHora('09:05')).toEqual({ hora: 9, minuto: 5 });
    expect(componerHora({ hora: 9, minuto: 5 })).toBe('09:05');
    expect(descomponerHora('9.30')).toBeNull();
  });

  it('escribe la fecha en español y avisa cuando no hay fecha', () => {
    expect(textoFecha('2026-10-20')).toMatch(/20 de octubre de 2026/);
    expect(textoFecha('')).toBe('Sin fecha seleccionada');
  });
});
