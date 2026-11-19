import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TarjetaConexion from './TarjetaConexion';
import { CONEXIONES } from '../../dominio/marea';

describe('TarjetaConexion', () => {
  it('muestra la función, marca la elegida y avisa al pincharla', async () => {
    const alElegir = vi.fn();
    render(<TarjetaConexion conexion={CONEXIONES[0]} activa alElegir={alElegir} />);
    const boton = screen.getByRole('button', { name: /Agenda y Google Meet/ });
    expect(boton).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(boton);
    expect(alElegir).toHaveBeenCalledWith(CONEXIONES[0]);
  });

  it('sin función muestra "Nuevo módulo", que no se puede elegir', () => {
    render(<TarjetaConexion />);
    expect(screen.getByText('Nuevo módulo')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
