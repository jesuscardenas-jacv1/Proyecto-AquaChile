import { describe, expect, it } from 'vitest';
import {
  conexionesDelRol,
  fechaHoraCorta,
  esAtajoMarea,
  guardarTema,
  leerTema,
  minimizarAlDesplazar,
  nombreModulo,
  primerNombre,
  subtituloBienvenida,
} from './marea';

const almacen = (inicial = {}) => {
  const datos = { ...inicial };
  return { getItem: (k) => datos[k] ?? null, setItem: (k, v) => { datos[k] = v; } };
};

describe('dominio de Marea', () => {
  it('nombra el módulo de la pantalla actual', () => {
    expect(nombreModulo('/')).toBe('Dashboard');
    expect(nombreModulo('/planner/entrevista/3')).toBe('Planner');
    expect(nombreModulo('/postulaciones')).toBe('Postulaciones');
  });

  it('muestra a cada rol solo sus funciones (el admin ve todas)', () => {
    const ids = (rol) => conexionesDelRol(rol).map((c) => c.id);
    expect(ids('evaluador')).toEqual(['agenda', 'buscar', 'solicitudes', 'guia']);
    expect(ids('analista')).toEqual(['buscar', 'cv', 'solicitudes', 'ofertas']);
    expect(ids('jefatura')).toEqual(['solicitudes']);
    expect(ids('admin')).toHaveLength(6);
  });

  it('muestra la fecha del historial en la hora de Chile', () => {
    expect(fechaHoraCorta('2026-11-23 18:05:00')).toBe('23-11 15:05');
    expect(fechaHoraCorta('')).toBe('');
  });

  it('reconoce Ctrl K y Cmd K', () => {
    expect(esAtajoMarea({ ctrlKey: true, key: 'k' })).toBe(true);
    expect(esAtajoMarea({ metaKey: true, key: 'K' })).toBe(true);
    expect(esAtajoMarea({ key: 'k' })).toBe(false);
  });

  it('guarda el tema y vuelve a claro si no hay almacenamiento', () => {
    const local = almacen();
    expect(leerTema(local)).toBe('claro');
    guardarTema('oscuro', local);
    expect(leerTema(local)).toBe('oscuro');
    const roto = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } };
    expect(leerTema(roto)).toBe('claro');
    expect(() => guardarTema('oscuro', roto)).not.toThrow();
  });

  it('minimiza la barra al bajar y la muestra al volver arriba de la página', () => {
    expect(minimizarAlDesplazar({ y: 300, anterior: 200, minimizada: false })).toBe(true);
    expect(minimizarAlDesplazar({ y: 250, anterior: 300, minimizada: true })).toBe(true);
    expect(minimizarAlDesplazar({ y: 202, anterior: 200, minimizada: false })).toBe(false);
    expect(minimizarAlDesplazar({ y: 10, anterior: 250, minimizada: true })).toBe(false);
    // En una lista interna, estar arriba de la lista no muestra la barra.
    expect(minimizarAlDesplazar({ y: 0, anterior: 30, minimizada: true, esPagina: false })).toBe(true);
  });

  it('arma la bienvenida con el primer nombre y los avisos pendientes', () => {
    expect(primerNombre('Ignacia Valdés Ortiz')).toBe('Ignacia');
    expect(subtituloBienvenida(1)).toBe('Tienes 1 aviso sin revisar. ¿Partimos por ahí?');
    expect(subtituloBienvenida(3)).toMatch(/3 avisos/);
    expect(subtituloBienvenida(0, () => 0.9)).toBe('¿Qué avanzamos hoy?');
  });
});
