import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import NotasEntrevistaPanel, { EstadoGuardado } from './NotasEntrevistaPanel';

describe('NotasEntrevistaPanel', () => {
  it('escribe notas y agrega una línea por competencia con la hora de la entrevista', async () => {
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    render(<NotasEntrevistaPanel notas="Llegó puntual." alCambiar={alCambiar} milisegundosActuales={125_000} />);

    await usuario.type(screen.getByLabelText('Notas de la entrevista'), '!');
    expect(alCambiar).toHaveBeenLastCalledWith('Llegó puntual.!');
    await usuario.click(screen.getByRole('button', { name: 'Liderazgo' }));
    expect(alCambiar).toHaveBeenLastCalledWith('Llegó puntual.\n[02:05 · Liderazgo] ');
  });

  it('destaca las competencias que ya tienen notas', () => {
    render(<NotasEntrevistaPanel notas="[01:00 · Liderazgo] coordina" alCambiar={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Liderazgo' })).toHaveClass('btn-primary');
    expect(screen.getByRole('button', { name: 'Trabajo en equipo' })).toHaveClass('btn-outline-primary');
    expect(screen.getByText(/^28 \/ 20\.000$/)).toBeInTheDocument();
  });

  it('informa el estado del guardado automático', () => {
    const ahora = Date.parse('2026-11-13T12:00:05Z');
    const { rerender } = render(<EstadoGuardado guardado={{ guardadoEn: '2026-11-13T12:00:00Z' }} ahora={ahora} />);
    expect(screen.getByText('Guardado hace 5 s')).toBeInTheDocument();
    rerender(<EstadoGuardado guardado={{ guardando: true }} />);
    expect(screen.getByText('Guardando…')).toBeInTheDocument();
    rerender(<EstadoGuardado guardado={{ error: 'No se pudo guardar: sin conexión' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('sin conexión');
    rerender(<EstadoGuardado guardado={{}} />);
    expect(screen.queryByText(/Guardado/)).toBeNull();
  });
});
