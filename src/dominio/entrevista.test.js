import { describe, expect, it } from 'vitest';
import {
  agregarLinea,
  agruparCriterios,
  citaParaNotas,
  competenciasConNotas,
  etiquetaCompetencia,
  hablantesDetectados,
  marcaTiempo,
  nombreHablante,
  textoTranscripcion,
  tiempoDesde,
  tieneContenido,
} from './entrevista';

describe('dominio de la entrevista', () => {
  it('formatea marcas de tiempo cortas y largas', () => {
    expect(marcaTiempo(0)).toBe('00:00');
    expect(marcaTiempo(65_400)).toBe('01:05');
    expect(marcaTiempo(3_725_000)).toBe('1:02:05');
    expect(marcaTiempo(-5)).toBe('00:00');
  });

  it('agrupa los requisitos del análisis en fortalezas, brechas y por confirmar', () => {
    const grupos = agruparCriterios([
      { requisito: 'Título', nivel: 'cumple' },
      { requisito: 'Experiencia', nivel: 'parcial' },
      { requisito: 'Licencia', nivel: 'sin-evidencia' },
      { requisito: 'Turnos', nivel: 'no-evaluable' },
    ]);
    expect(grupos.fortalezas.map((c) => c.requisito)).toEqual(['Título']);
    expect(grupos.brechas.map((c) => c.requisito)).toEqual(['Experiencia', 'Licencia']);
    expect(grupos.porConfirmar.map((c) => c.requisito)).toEqual(['Turnos']);
    expect(agruparCriterios(undefined).fortalezas).toEqual([]);
  });

  it('nombra a los hablantes por su rol o por su número', () => {
    expect(nombreHablante('Guest-2', {})).toBe('Hablante 2');
    expect(nombreHablante('Guest-1', { 'Guest-1': 'Psicóloga' })).toBe('Psicóloga');
    expect(nombreHablante('', {})).toBe('Hablante');
    expect(hablantesDetectados([{ hablante: 'Guest-2' }, { hablante: 'Guest-1' }, { hablante: '' }, { hablante: 'Guest-2' }])).toEqual([
      'Guest-1',
      'Guest-2',
    ]);
  });

  it('arma el texto de la transcripción uniendo frases seguidas del mismo hablante', () => {
    const texto = textoTranscripcion(
      [
        { hablante: 'Guest-1', inicioMs: 1000, texto: '¿Cómo coordina?' },
        { hablante: 'Guest-2', inicioMs: 4000, texto: 'Con mi equipo.' },
        { hablante: 'Guest-2', inicioMs: 6000, texto: 'Cada mañana.' },
        { hablante: 'Guest-1', inicioMs: 3_661_000, texto: 'Gracias.' },
      ],
      { 'Guest-1': 'Psicóloga', 'Guest-2': 'Postulante' },
    );
    expect(texto).toBe(
      '[00:00:01] Psicóloga: ¿Cómo coordina?\n\n[00:00:04] Postulante: Con mi equipo. Cada mañana.\n\n[01:01:01] Psicóloga: Gracias.',
    );
  });

  it('cita una frase y etiqueta notas por competencia', () => {
    const cita = citaParaNotas({ hablante: 'Guest-2', inicioMs: 192_000, texto: 'Paré la faena.' }, { 'Guest-2': 'Postulante' });
    expect(cita).toBe('[03:12 · Postulante] "Paré la faena."');
    expect(agregarLinea('', cita)).toBe(cita);
    expect(agregarLinea('Primera nota\n\n', 'Segunda')).toBe('Primera nota\nSegunda');
    expect(etiquetaCompetencia('Liderazgo', 61_000)).toBe('[01:01 · Liderazgo] ');
    expect(competenciasConNotas('[01:01 · Liderazgo] algo\n[02:00 · Trabajo en equipo] otro')).toEqual([
      'Trabajo en equipo',
      'Liderazgo',
    ]);
  });

  it('dice hace cuánto se guardó', () => {
    const ahora = Date.parse('2026-11-13T12:00:10Z');
    expect(tiempoDesde('2026-11-13T12:00:05Z', ahora)).toBe('hace 5 s');
    expect(tiempoDesde('2026-11-13 11:57:10', ahora)).toBe('hace 3 min');
    expect(tiempoDesde('2026-11-13T10:00:00Z', ahora)).toBe('hace 2 h');
    expect(tiempoDesde(null, ahora)).toBe('');
    expect(tiempoDesde('no es fecha', ahora)).toBe('');
  });

  it('sabe si la entrevista tiene contenido', () => {
    expect(tieneContenido({ notas: '  ', transcripcion: [] })).toBe(false);
    expect(tieneContenido({ notas: 'algo' })).toBe(true);
    expect(tieneContenido({ transcripcion: [{ texto: 'x' }] })).toBe(true);
  });
});
