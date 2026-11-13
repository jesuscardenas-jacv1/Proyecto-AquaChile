import { describe, expect, it } from 'vitest';
import { agruparRequisitos, guiaEntrevista, nivelRequisito, textoFuente, tramoCumplimiento } from './analisisCv';

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

  it('arma la guía de la entrevista desde un análisis nuevo o uno antiguo', () => {
    const guia = guiaEntrevista({
      criterios: [
        { requisito: 'Título', tipo: 'obligatorio', nivel: 'cumple', evidencia: 'Técnico' },
        { requisito: '2 años', tipo: 'obligatorio', nivel: 'parcial', evidencia: 'Tiene 1 año' },
        { requisito: 'Turnos', tipo: 'obligatorio', nivel: 'no-evaluable', evidencia: '' },
      ],
      cumplimiento: { porcentaje: 50 },
      preguntasSugeridas: ['¿Turnos?'],
      alertas: ['Período sin información'],
    });
    expect(guia).toEqual({
      porcentaje: 50,
      brechas: [{ requisito: '2 años', tipo: 'obligatorio', detalle: 'Tiene 1 año' }],
      porConfirmar: ['Turnos'],
      preguntas: ['¿Turnos?'],
      alertas: ['Período sin información'],
    });

    const antigua = guiaEntrevista({ brechas: [{ requisito: 'Licencia', detalle: 'No la menciona' }], preguntasSugeridas: [] });
    expect(antigua.brechas).toEqual([{ requisito: 'Licencia', tipo: 'obligatorio', detalle: 'No la menciona' }]);
    expect(antigua.porcentaje).toBeNull();
    expect(guiaEntrevista(null)).toBeNull();
  });
});
