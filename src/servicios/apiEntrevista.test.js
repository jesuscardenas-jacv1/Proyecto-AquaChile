import { afterEach, describe, expect, it } from 'vitest';
import { apiEntrevista, entrevistaVacia } from './apiEntrevista';

afterEach(() => localStorage.clear());

describe('apiEntrevista sin sesión en el servidor (modo local)', () => {
  it('parte vacía, sin análisis ni transcripción', async () => {
    expect(apiEntrevista.conectado()).toBe(false);
    const { entrevista, analisis, tienePostulacion } = await apiEntrevista.obtener(7);
    expect(entrevista).toEqual(entrevistaVacia(7));
    expect([analisis, tienePostulacion]).toEqual([null, false]);
  });

  it('guarda las notas en este navegador y las recupera', async () => {
    const guardada = await apiEntrevista.guardar(7, { notas: 'Llegó puntual.', preguntas: ['¿Turnos?'] });
    expect(guardada.actualizadoEn).toBeTruthy();
    const { entrevista } = await apiEntrevista.obtener(7);
    expect([entrevista.notas, entrevista.preguntas]).toEqual(['Llegó puntual.', ['¿Turnos?']]);
    expect((await apiEntrevista.obtener(8)).entrevista.notas).toBe('');
  });

  it('tolera datos dañados en el navegador', async () => {
    localStorage.setItem('aquachile_entrevista_9', '{roto');
    expect((await apiEntrevista.obtener(9)).entrevista).toEqual(entrevistaVacia(9));
  });
});
