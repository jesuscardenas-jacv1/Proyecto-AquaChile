import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SelectorFecha, SelectorHora } from './SelectorRueda';

describe('SelectorFecha', () => {
  it('pide elegir la fecha cuando todavía no hay una', () => {
    render(<SelectorFecha valor="" onChange={() => {}} />);
    expect(screen.getByText('Elija día, mes y año')).toBeInTheDocument();
  });

  it('muestra la fecha elegida en palabras', () => {
    render(<SelectorFecha valor="2026-10-20" onChange={() => {}} />);
    expect(screen.getByText(/20 de octubre de 2026/)).toBeInTheDocument();
  });

  it('cambia el día con la rueda del mouse', () => {
    const cambios = vi.fn();
    render(<SelectorFecha valor="2026-10-20" onChange={cambios} />);

    fireEvent.wheel(screen.getByRole('listbox', { name: 'Día' }), { deltaY: 60 });
    expect(cambios).toHaveBeenLastCalledWith('2026-10-21');

    fireEvent.wheel(screen.getByRole('listbox', { name: 'Día' }), { deltaY: -60 });
    expect(cambios).toHaveBeenLastCalledWith('2026-10-19');
  });

  it('ajusta el día al cambiar de mes', () => {
    const cambios = vi.fn();
    render(<SelectorFecha valor="2026-01-31" onChange={cambios} />);
    fireEvent.wheel(screen.getByRole('listbox', { name: 'Mes' }), { deltaY: 60 });
    expect(cambios).toHaveBeenLastCalledWith('2026-02-28');
  });

  it('muestra en la rueda el día elegido cuando la fecha cambia desde fuera', () => {
    const { rerender } = render(<SelectorFecha valor="2026-10-20" onChange={() => {}} />);
    rerender(<SelectorFecha valor="2026-10-05" onChange={() => {}} />);
    expect(screen.getByRole('listbox', { name: 'Día' }).scrollTop).toBe(4 * 36);
  });

  it('elige el año con las flechas del teclado', async () => {
    const usuario = userEvent.setup();
    const cambios = vi.fn();
    render(<SelectorFecha valor="2026-10-20" onChange={cambios} />);

    screen.getByRole('listbox', { name: 'Año' }).focus();
    await usuario.keyboard('{ArrowDown}');
    expect(cambios).toHaveBeenLastCalledWith('2027-10-20');
  });
});

describe('posición inicial', () => {
  it('muestra el día elegido al abrir la ventana, sin cambiarlo', () => {
    const cambios = vi.fn();
    render(<SelectorFecha valor="2026-10-20" onChange={cambios} />);
    expect(screen.getByRole('listbox', { name: 'Día' }).scrollTop).toBe(19 * 36);
    expect(cambios).not.toHaveBeenCalled();
  });
});

describe('SelectorHora', () => {
  it('avanza la hora con la rueda y mantiene el minuto', () => {
    const cambios = vi.fn();
    render(<SelectorHora valor="09:30" onChange={cambios} />);

    fireEvent.wheel(screen.getByRole('listbox', { name: 'Hora' }), { deltaY: 60 });
    expect(cambios).toHaveBeenLastCalledWith('10:30');
  });

  it('elige un minuto al hacer clic', async () => {
    const usuario = userEvent.setup();
    const cambios = vi.fn();
    render(<SelectorHora valor="09:30" onChange={cambios} />);

    await usuario.click(within(screen.getByRole('listbox', { name: 'Minuto' })).getByRole('option', { name: '45' }));
    expect(cambios).toHaveBeenLastCalledWith('09:45');
  });

  it('no ofrece minutos después de las 20:00', () => {
    render(<SelectorHora valor="20:00" onChange={() => {}} />);
    const minutos = within(screen.getByRole('listbox', { name: 'Minuto' })).getAllByRole('option');
    expect(minutos).toHaveLength(1);
  });
});

describe('SelectorHora con selector AM/PM', () => {
  it('pasa a PM dejando la hora en la tarde', async () => {
    const usuario = userEvent.setup();
    const cambios = vi.fn();
    render(<SelectorHora valor="10:00" onChange={cambios} />);

    await usuario.click(screen.getByRole('button', { name: 'PM' }));
    expect(cambios).toHaveBeenLastCalledWith('12:00');
  });

  it('pasa a AM dejando la hora en la mañana', async () => {
    const usuario = userEvent.setup();
    const cambios = vi.fn();
    render(<SelectorHora valor="15:30" onChange={cambios} />);

    await usuario.click(screen.getByRole('button', { name: 'AM' }));
    expect(cambios).toHaveBeenLastCalledWith('11:30');
  });

  it('marca el periodo actual', () => {
    render(<SelectorHora valor="15:30" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'PM' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'AM' })).toHaveAttribute('aria-pressed', 'false');
  });
});
