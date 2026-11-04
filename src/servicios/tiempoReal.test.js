import { describe, expect, it } from 'vitest';
import { analizarEventos } from './tiempoReal';

describe('analizarEventos', () => {
  it('separa los eventos completos y deja pendiente el fragmento incompleto', () => {
    const fragmento =
      'event: notificacion\ndata: {"mensaje":"Nuevo candidato"}\n\n' +
      'event: datos\ndata: {"ruta":"/api/candidatos"}\n\n' +
      'event: notificacion\ndata: {"mensaje":"Incompleto';
    const { eventos, resto } = analizarEventos(fragmento);
    expect(eventos).toEqual([
      { tipo: 'notificacion', datos: { mensaje: 'Nuevo candidato' } },
      { tipo: 'datos', datos: { ruta: '/api/candidatos' } },
    ]);
    expect(resto).toContain('Incompleto');
  });

  it('ignora los latidos y los bloques con datos no válidos', () => {
    const { eventos } = analizarEventos(': latido\n\nevent: datos\ndata: {no-es-json}\n\n');
    expect(eventos).toEqual([]);
  });
});
