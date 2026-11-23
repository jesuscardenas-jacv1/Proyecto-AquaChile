import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TarjetaCandidatos from './TarjetaCandidatos';

const candidato = (id, extra = {}) => ({
  candidatoId: id, nombre: `Persona ${id}`, ciudad: 'Puerto Montt', cargo: 'Analista', estado: 'Recibida',
  conPerfil: true, coincidencias: [], porcentaje: null, ...extra,
});
const tarjeta = (extra) => ({ tipo: 'candidatos', titulo: 'Personas de Puerto Montt, con Power BI', total: 2, candidatos: [], nota: 'La decisión es tuya.', ...extra });

describe('TarjetaCandidatos', () => {
  it('muestra ciudad, cargo, estado, evidencia del CV y el % si existe', () => {
    const candidatos = [
      candidato(1, { coincidencias: [{ habilidad: 'Power BI', evidencia: 'Tableros de costos' }], porcentaje: 80 }),
      candidato(2, { conPerfil: false }),
    ];
    render(<TarjetaCandidatos tarjeta={tarjeta({ candidatos })} />);
    const [primera, segunda] = screen.getAllByRole('listitem');
    expect(within(primera).getByText('Analista, Puerto Montt')).toBeInTheDocument();
    expect(within(primera).getByText(/Tableros de costos/)).toBeInTheDocument();
    expect(within(primera).getByText('80%')).toBeInTheDocument();
    expect(within(segunda).getByText('Su CV aún no está leído.')).toBeInTheDocument();
    expect(within(segunda).queryByText(/%/)).toBeNull();
    expect(screen.getByText('La decisión es tuya.')).toBeInTheDocument();
  });

  it('avisa cuando hay más resultados que los mostrados', () => {
    render(<TarjetaCandidatos tarjeta={tarjeta({ total: 12, candidatos: [candidato(1)] })} />);
    expect(screen.getByText(/Y 11 más/)).toBeInTheDocument();
  });
});
