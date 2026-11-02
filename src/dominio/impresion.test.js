import { describe, expect, it } from 'vitest';
import { ALTO_A4_PX, escalaParaUnaHoja } from './impresion';

describe('escalaParaUnaHoja', () => {
  it('no agranda lo que ya cabe en la hoja', () => {
    expect(escalaParaUnaHoja(800)).toBe(1);
  });

  it('reduce lo que no cabe, dejando un margen de seguridad', () => {
    const escala = escalaParaUnaHoja(1400);
    expect(escala).toBeLessThan(1);
    expect(1400 * escala).toBeLessThanOrEqual(ALTO_A4_PX);
  });

  it('no baja de la escala mínima y tolera alturas inválidas', () => {
    expect(escalaParaUnaHoja(10000)).toBe(0.5);
    expect(escalaParaUnaHoja(0)).toBe(1);
    expect(escalaParaUnaHoja(Number.NaN)).toBe(1);
  });
});
