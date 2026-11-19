import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AvisoEsquina from './AvisoEsquina';

describe('AvisoEsquina', () => {
  afterEach(() => vi.useRealTimers());

  it('muestra el aviso y se cierra solo a los 6 segundos', () => {
    vi.useFakeTimers();
    const alCerrar = vi.fn();
    render(<AvisoEsquina texto="Listo, la entrevista de Valentina quedó agendada." alCerrar={alCerrar} />);
    expect(screen.getByRole('status')).toHaveTextContent('quedó agendada');
    act(() => vi.advanceTimersByTime(6000));
    expect(alCerrar).toHaveBeenCalled();
  });

  it('se puede cerrar antes con la ✕', async () => {
    const alCerrar = vi.fn();
    render(<AvisoEsquina texto="Hecho." alCerrar={alCerrar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }));
    expect(alCerrar).toHaveBeenCalled();
  });
});
