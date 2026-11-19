import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TarjetaConfirmacion from './TarjetaConfirmacion';

const accion = { tipo: 'confirmar_agenda', solicitudId: 101, fecha: '2026-11-23', hora: '11:00', modalidad: 'Presencial' };
const tarjeta = { tipo: 'confirmacion', titulo: 'Entrevista con Valentina Ríos Ojeda', detalle: ['lunes 23-11 · 11:00', 'Presencial'], accion };

describe('TarjetaConfirmacion', () => {
  it('solo confirma al pulsar «Confirmar», una vez', async () => {
    const alElegir = vi.fn();
    render(<TarjetaConfirmacion tarjeta={tarjeta} alElegir={alElegir} />);
    expect(screen.getByText('lunes 23-11 · 11:00')).toBeInTheDocument();
    expect(alElegir).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(alElegir).toHaveBeenCalledWith(accion, 'Confirmar');
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
  });

  it('«Elegir otra hora» vuelve a pedir las horas de esa solicitud', async () => {
    const alElegir = vi.fn();
    render(<TarjetaConfirmacion tarjeta={tarjeta} alElegir={alElegir} />);
    await userEvent.click(screen.getByRole('button', { name: 'Elegir otra hora' }));
    expect(alElegir).toHaveBeenCalledWith({ tipo: 'agendar', solicitudId: 101 }, 'Elegir otra hora');
  });
});
