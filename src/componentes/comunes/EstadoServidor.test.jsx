import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import EstadoServidor from './EstadoServidor';
import { useDatos } from '../../datos/DatosContext';
import { datosDePrueba, renderConContexto } from '../../pruebas/utilidades';

/** Muestra el error de operación del contexto para comprobar que parte vacío. */
function ConError() {
  const { errorOperacion } = useDatos();
  return <span>{errorOperacion ?? 'sin error'}</span>;
}

describe('EstadoServidor', () => {
  it('no muestra nada si no hay carga ni errores', () => {
    renderConContexto(
      <>
        <EstadoServidor />
        <ConError />
      </>,
      { datosIniciales: datosDePrueba },
    );
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
