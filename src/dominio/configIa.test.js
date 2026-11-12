import { describe, expect, it } from 'vitest';
import { hayCambios, nombreModelo, validarIndicaciones } from './configIa';

describe('configIa', () => {
  it('valida el largo de las indicaciones', () => {
    expect(validarIndicaciones('corto')).toMatch(/al menos 20/);
    expect(validarIndicaciones('x'.repeat(30))).toBeNull();
    expect(validarIndicaciones('x'.repeat(50), 40)).toMatch(/no pueden superar 40/);
  });

  it('detecta cambios ignorando espacios al inicio y al final', () => {
    const vigente = { indicaciones: 'Texto', modelo: '', esfuerzo: 'medium' };
    expect(hayCambios({ ...vigente, indicaciones: ' Texto ' }, vigente)).toBe(false);
    expect(hayCambios({ ...vigente, esfuerzo: 'low' }, vigente)).toBe(true);
    expect(hayCambios({ ...vigente, modelo: 'claude-haiku-5-5' }, vigente)).toBe(true);
  });

  it('nombra el modelo elegido o el del servidor', () => {
    const modelos = [{ id: 'claude-sonnet-5-5', nombre: 'Claude Sonnet 5.5' }];
    expect(nombreModelo('', modelos, 'claude-opus-5-5')).toBe('Del servidor (claude-opus-5-5)');
    expect(nombreModelo('claude-sonnet-5-5', modelos)).toBe('Claude Sonnet 5.5');
    expect(nombreModelo('otro', modelos)).toBe('otro');
  });
});
