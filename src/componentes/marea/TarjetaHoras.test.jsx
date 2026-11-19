import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TarjetaHoras from './TarjetaHoras';

const tarjeta = {
  tipo: 'horas',
  solicitudId: 101,
  nombre: 'Valentina Ríos Ojeda',
  cargo: 'Monitor Producción',
  fecha: '2026-11-23',
  bloques: [
    { hora: '11:00', primera: true },
    { hora: '12:00', primera: false },
  ],
  modalidades: ['Google Meet', 'Teams', 'Presencial'],
  modalidad: 'Google Meet',
};

describe('TarjetaHoras', () => {
  it('muestra el día, marca la primera libre y propone la hora con la modalidad elegida', async () => {
    const alElegir = vi.fn();
    render(<TarjetaHoras tarjeta={tarjeta} alElegir={alElegir} />);
    expect(screen.getByText('lunes 23-11')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '11:00, primera libre' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Google Meet' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Presencial' }));
    await userEvent.click(screen.getByRole('button', { name: '12:00' }));
    expect(alElegir).toHaveBeenCalledWith(
      { tipo: 'elegir_hora', solicitudId: 101, fecha: '2026-11-23', hora: '12:00', modalidad: 'Presencial' },
      '12:00 · Presencial',
    );
  });

  it('desactivada no deja elegir', () => {
    render(<TarjetaHoras tarjeta={tarjeta} alElegir={vi.fn()} desactivado />);
    expect(screen.getByRole('button', { name: '12:00' })).toBeDisabled();
  });
});
