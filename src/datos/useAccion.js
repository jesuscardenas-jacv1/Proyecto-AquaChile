import { useCallback, useState } from 'react';
import { mensajeDeError } from '../servicios/errores';

/**
 * Ejecuta una acción asíncrona de datos (crear, editar, eliminar...) y guarda su error
 * para mostrarlo en pantalla.
 *
 * @returns {{ ejecutar: Function, error: string, enCurso: boolean, limpiarError: Function }}
 *   `ejecutar(fn)` resuelve a { ok: true, valor } o { ok: false, error }.
 */
export function useAccion() {
  const [error, setError] = useState('');
  const [enCurso, setEnCurso] = useState(false);

  const ejecutar = useCallback(async (accion) => {
    setError('');
    setEnCurso(true);
    try {
      const valor = await accion();
      return { ok: true, valor };
    } catch (excepcion) {
      setError(mensajeDeError(excepcion));
      return { ok: false, error: excepcion };
    } finally {
      setEnCurso(false);
    }
  }, []);

  const limpiarError = useCallback(() => setError(''), []);

  return { ejecutar, error, enCurso, limpiarError };
}
