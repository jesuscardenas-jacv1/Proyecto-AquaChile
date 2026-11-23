import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TarjetaRegistro from './TarjetaRegistro';

describe('TarjetaRegistro', () => {
  it('muestra los conteos', () => {
    render(<TarjetaRegistro tarjeta={{ tipo: 'conteo', titulo: 'Personas por ciudad', grupos: [{ nombre: 'Puerto Montt', total: 3 }, { nombre: 'Castro', total: 1 }] }} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Puerto Montt')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('muestra el historial con quién y cuándo', () => {
    const eventos = [{ id: 1, titulo: 'Postulación recibida', detalle: 'Ana · Operador', usuario: 'Portal', fecha: '2026-11-23 18:05:00' }];
    render(<TarjetaRegistro tarjeta={{ tipo: 'actividad', titulo: 'Actividad reciente', eventos }} />);
    expect(screen.getByText('Postulación recibida')).toBeInTheDocument();
    expect(screen.getByText('23-11 15:05, Portal')).toBeInTheDocument();
  });
});
