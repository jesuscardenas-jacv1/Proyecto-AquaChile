import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SelectorFecha, SelectorHora } from './SelectorRueda';

// Hoy es 5 de noviembre de 2026 para todas las pruebas de fecha.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 5, 12, 0, 0));
});
afterAll(() => {
  vi.useRealTimers();
});

describe('SelectorFecha', () => {
  it('pide elegir la fecha cuando todavía no hay una', () => {
    render(<SelectorFecha valor="" onChange={() => {}} />);
    expect(screen.getByText('Elija día, mes y año')).toBeInTheDocument();
  });

  it('muestra la fecha elegida en palabras', () => {
    render(<SelectorFecha valor="2026-11-20" onChange={() => {}} />);
    expect(screen.getByText(/20 de noviembre de 2026/)).toBeInTheDocument();
  });

  it('cambia el día con la rueda del mouse', () => {
    const cambios = vi.fn();
    render(<SelectorFecha valor="2026-11-20" onChange={cambios} />);

    fireEvent.wheel(screen.getByRole('listbox', { name: 'Día' }), { deltaY: 60 });
    expect(cambios).toHaveBeenLastCalledWith('2026-11-21');

    fireEvent.wheel(screen.getByRole('listbox', { name: 'Día' }), { deltaY: -60 });
    expect(cambios).toHaveBeenLastCalledWith('2026-11-19');
  });

  it('el mes avanza desde el actual: noviembre, diciembre, enero…', () => {
    const cambios = vi.fn();
    render(<SelectorFecha valor="2026-11-20" onChange={cambios} />);
    const meses = within(screen.getByRole('listbox', { name: 'Mes' })).getAllByRole('option');
    expect(meses[0]).toHaveTextContent('Noviembre');
    expect(meses[1]).toHaveTextContent('Diciembre');
    expect(meses[2]).toHaveTextContent('Enero');

    fireEvent.wheel(screen.getByRole('listbox', { name: 'Mes' }), { deltaY: 60 });
    expect(cambios).toHaveBeenLastCalledWith('2026-12-20');
  });

  it('al pasar de diciembre a enero cambia el año al siguiente', () => {
    const cambios = vi.fn();
    render(<SelectorFecha valor="2026-12-20" onChange={cambios} />);
    fireEvent.wheel(screen.getByRole('listbox', { name: 'Mes' }), { deltaY: 60 });
    expect(cambios).toHaveBeenLastCalledWith('2027-01-20');
  });

  it('ajusta el día al cambiar de mes', () => {
    const cambios = vi.fn();
    render(<SelectorFecha valor="2026-11-30" onChange={cambios} />);
    fireEvent.wheel(screen.getByRole('listbox', { name: 'Mes' }), { deltaY: 60 });
    expect(cambios).toHaveBeenLastCalledWith('2026-12-30');
  });

  it('los años empiezan en el actual y no ofrecen años pasados', () => {
    render(<SelectorFecha valor="2026-11-20" onChange={() => {}} />);
    const anios = within(screen.getByRole('listbox', { name: 'Año' })).getAllByRole('option');
    expect(anios[0]).toHaveTextContent('2026');
    expect(anios[1]).toHaveTextContent('2027');
    expect(screen.queryByRole('option', { name: '2025' })).not.toBeInTheDocument();
  });

  it('en el mes actual no ofrece días anteriores a hoy', () => {
    render(<SelectorFecha valor="2026-11-20" onChange={() => {}} />);
    const dias = within(screen.getByRole('listbox', { name: 'Día' })).getAllByRole('option');
    expect(dias[0]).toHaveTextContent('5');
    expect(screen.queryByRole('option', { name: '4' })).not.toBeInTheDocument();
  });

  it('una fecha pasada se muestra como hoy y no se puede guardar', () => {
    const cambios = vi.fn();
    render(<SelectorFecha valor="2026-10-20" onChange={cambios} />);
    expect(screen.getByText('Elija día, mes y año')).toBeInTheDocument();
    fireEvent.wheel(screen.getByRole('listbox', { name: 'Día' }), { deltaY: -60 });
    expect(cambios).toHaveBeenLastCalledWith('2026-11-05');
  });

  it('muestra en la rueda el día elegido cuando la fecha cambia desde fuera', () => {
    const { rerender } = render(<SelectorFecha valor="2026-11-20" onChange={() => {}} />);
    rerender(<SelectorFecha valor="2026-11-10" onChange={() => {}} />);
    expect(screen.getByRole('listbox', { name: 'Día' }).scrollTop).toBe(5 * 36);
  });

  it('elige el año con las flechas del teclado', async () => {
    const usuario = userEvent.setup();
    const cambios = vi.fn();
    render(<SelectorFecha valor="2026-11-20" onChange={cambios} />);

    screen.getByRole('listbox', { name: 'Año' }).focus();
    await usuario.keyboard('{ArrowDown}');
    expect(cambios).toHaveBeenLastCalledWith('2027-11-20');
  });
});

describe('posición inicial', () => {
  it('muestra el día elegido al abrir la ventana, sin cambiarlo', () => {
    const cambios = vi.fn();
    render(<SelectorFecha valor="2026-11-20" onChange={cambios} />);
    expect(screen.getByRole('listbox', { name: 'Día' }).scrollTop).toBe(15 * 36);
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

describe('SelectorHora con periodo automático', () => {
  it('muestra AM o PM según la hora del reloj, sin botones', () => {
    const { rerender } = render(<SelectorHora valor="10:00" onChange={() => {}} />);
    expect(screen.getByText('10:00 h (AM)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'AM' })).not.toBeInTheDocument();

    rerender(<SelectorHora valor="12:00" onChange={() => {}} />);
    expect(screen.getByText('12:00 h (PM)')).toBeInTheDocument();
  });
});
