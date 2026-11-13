import { describe, expect, it } from 'vitest';
import { nivelRequisito, textoFuente, tramoCumplimiento } from './analisisCv';

describe('analisisCv', () => {
  it('describe el tramo del porcentaje sin emitir un dictamen', () => {
    expect(tramoCumplimiento(80).texto).toMatch(/mayoría/);
    expect(tramoCumplimiento(75).color).toBe('bg-success');
    expect(tramoCumplimiento(50).color).toBe('bg-warning');
    expect(tramoCumplimiento(10).texto).toMatch(/pocos/);
    expect(tramoCumplimiento(null)).toBeNull();
    expect(tramoCumplimiento(undefined)).toBeNull();
  });

  it('da etiqueta a cada nivel y trata uno desconocido como sin evidencia', () => {
    expect(nivelRequisito('cumple').etiqueta).toBe('Cumple');
    expect(nivelRequisito('no-evaluable').etiqueta).toMatch(/entrevista/);
    expect(nivelRequisito('otro').etiqueta).toBe('Sin evidencia en el CV');
  });

  it('indica de dónde salieron los requisitos', () => {
    expect(textoFuente('oferta')).toBe('los requisitos de la oferta');
    expect(textoFuente('descriptor')).toMatch(/descriptor/);
  });
});
