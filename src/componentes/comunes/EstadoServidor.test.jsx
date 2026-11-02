import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EstadoServidor from './EstadoServidor';
import { ContextoDatos, useDatos } from '../../datos/DatosContext';
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

  const conContexto = (valor) =>
    render(
      <ContextoDatos.Provider value={{ cargando: false, errorOperacion: null, limpiarError: vi.fn(), ...valor }}>
        <EstadoServidor />
      </ContextoDatos.Provider>,
    );

  it('avisa el modo local cuando hay servidor configurado y permite reintentar', async () => {
    const usuario = userEvent.setup();
    const reconectar = vi.fn().mockResolvedValue(false);
    conContexto({ modo: 'local', servidorConfigurado: true, reconectar });

    expect(screen.getByText('Sin conexión con el servidor')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Reintentar ahora' }));
    expect(reconectar).toHaveBeenCalled();
    expect(await screen.findByText('El servidor sigue sin responder.')).toBeInTheDocument();
  });

  it('sin servidor configurado (demo en el navegador) no muestra el aviso', () => {
    conContexto({ modo: 'local', servidorConfigurado: false, reconectar: vi.fn() });
    expect(screen.queryByText('Sin conexión con el servidor')).toBeNull();
  });
});
