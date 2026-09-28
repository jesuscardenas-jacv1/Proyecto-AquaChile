import { describe, expect, it } from 'vitest';
import { CLAVE_ALMACEN, cargarDatos, generarId, guardarDatos, obtenerSemilla } from './almacen';

describe('almacen', () => {
  it('devuelve los datos semilla cuando no hay información guardada', () => {
    const datos = cargarDatos();
    expect(datos.candidatos.length).toBeGreaterThan(0);
    expect(datos.solicitudes.length).toBeGreaterThan(0);
  });

  it('guarda y recupera los datos desde localStorage', () => {
    const datos = { ...obtenerSemilla(), solicitudes: [] };
    expect(guardarDatos(datos)).toBe(true);
    expect(cargarDatos().solicitudes).toEqual([]);
  });

  it('no comparte la referencia con la semilla original', () => {
    const semilla = obtenerSemilla();
    semilla.candidatos.push({ id: 99 });
    expect(obtenerSemilla().candidatos.some((c) => c.id === 99)).toBe(false);
  });

  it('usa la semilla si el contenido guardado está corrupto', () => {
    window.localStorage.setItem(CLAVE_ALMACEN, '{no-es-json');
    expect(cargarDatos().candidatos.length).toBeGreaterThan(0);
  });

  it('completa las colecciones faltantes con la semilla', () => {
    window.localStorage.setItem(CLAVE_ALMACEN, JSON.stringify({ candidatos: [] }));
    const datos = cargarDatos();
    expect(datos.candidatos).toEqual([]);
    expect(datos.evaluaciones.length).toBeGreaterThan(0);
  });

  it('genera el siguiente id correlativo', () => {
    expect(generarId([])).toBe(1);
    expect(generarId([{ id: 1 }, { id: 7 }])).toBe(8);
  });
});
