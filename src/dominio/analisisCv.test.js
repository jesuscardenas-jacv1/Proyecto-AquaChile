import { describe, expect, it } from 'vitest';
import { agruparRequisitos, nivelRequisito, textoFuente, tramoCumplimiento } from './analisisCv';

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

  it('agrupa los requisitos en cumple, brechas (obligatorios primero) y por confirmar', () => {
    const grupos = agruparRequisitos([
      { requisito: 'Deseable Excel', tipo: 'deseable', nivel: 'sin-evidencia' },
      { requisito: 'Título técnico', tipo: 'obligatorio', nivel: 'cumple' },
      { requisito: '3 años', tipo: 'obligatorio', nivel: 'parcial' },
      { requisito: 'Turnos', tipo: 'obligatorio', nivel: 'no-evaluable' },
    ]);
    expect(grupos.cumple.map((c) => c.requisito)).toEqual(['Título técnico']);
    expect(grupos.brechas.map((c) => c.requisito)).toEqual(['3 años', 'Deseable Excel']);
    expect(grupos.porConfirmar.map((c) => c.requisito)).toEqual(['Turnos']);
    expect(agruparRequisitos()).toEqual({ cumple: [], brechas: [], porConfirmar: [] });
  });
});
