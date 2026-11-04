import { describe, expect, it } from 'vitest';
import { formatearFecha, tiempoTranscurrido } from './formateo';

describe('tiempoTranscurrido', () => {
  const ahora = new Date('2026-11-04T12:00:00Z');

  it('expresa el tiempo desde una fecha de la BD (UTC)', () => {
    expect(tiempoTranscurrido('2026-11-04 11:59:40', ahora)).toBe('hace un momento');
    expect(tiempoTranscurrido('2026-11-04 11:55:00', ahora)).toBe('hace 5 min');
    expect(tiempoTranscurrido('2026-11-04 09:00:00', ahora)).toBe('hace 3 h');
    expect(tiempoTranscurrido('2026-11-03 10:00:00', ahora)).toBe('hace 1 día');
    expect(tiempoTranscurrido('2026-11-01 10:00:00', ahora)).toBe('hace 3 días');
  });

  it('desde los 7 días muestra la fecha y tolera valores inválidos', () => {
    expect(tiempoTranscurrido('2026-10-20 10:00:00', ahora)).toBe(formatearFecha('2026-10-20'));
    expect(tiempoTranscurrido('no es fecha', ahora)).toBe('');
  });
});
