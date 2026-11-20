import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TarjetaAnalisis from './TarjetaAnalisis';

const tarjeta = {
  tipo: 'analisis',
  nombre: 'Paula Leiva',
  mayorAjuste: { cargo: 'Técnico Eléctrico', porcentaje: 81 },
  cargos: [
    { cargo: 'Técnico Eléctrico', porcentaje: 81 },
    { cargo: 'Monitor Producción', porcentaje: 60 },
  ],
  fortalezas: ['Técnico en electricidad'],
  aConfirmar: ['2 años de experiencia'],
  nota: 'La decisión es tuya.',
};

describe('TarjetaAnalisis', () => {
  it('muestra el mayor ajuste, el % por cargo, fortalezas, lo que falta confirmar y la nota', () => {
    render(<TarjetaAnalisis tarjeta={tarjeta} />);
    expect(screen.getByText('Mayor ajuste')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '81% de los requisitos' })).toBeInTheDocument();
    expect(screen.getByText('Monitor Producción')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('Técnico en electricidad')).toHaveClass('marea-fuerte');
    expect(screen.getByText('2 años de experiencia')).toHaveClass('marea-debil');
    expect(screen.getByText('La decisión es tuya.')).toBeInTheDocument();
  });

  it('con un solo cargo no repite la lista de cargos', () => {
    render(<TarjetaAnalisis tarjeta={{ ...tarjeta, cargos: [tarjeta.cargos[0]], fortalezas: [], aConfirmar: [] }} />);
    expect(screen.queryByText('% de requisitos por cargo')).toBeNull();
    expect(screen.getByText('Nada pendiente.')).toBeInTheDocument();
  });

  it('sin % (análisis sin requisitos evaluables) muestra «—» y «Sin %», no 0 %', () => {
    const sinPct = { ...tarjeta, mayorAjuste: { cargo: 'Técnico Eléctrico', porcentaje: null }, cargos: [{ cargo: 'Técnico Eléctrico', porcentaje: null }, { cargo: 'Monitor Producción', porcentaje: 60 }] };
    render(<TarjetaAnalisis tarjeta={sinPct} />);
    expect(screen.getByRole('img', { name: 'Sin % de requisitos' })).toHaveTextContent('—');
    expect(screen.getByText('Sin %')).toBeInTheDocument();
    expect(screen.queryByText('0%')).toBeNull();
  });
});
