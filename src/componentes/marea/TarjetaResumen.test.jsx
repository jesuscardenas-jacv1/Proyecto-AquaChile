import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TarjetaResumen from './TarjetaResumen';

describe('TarjetaResumen', () => {
  it('muestra el resumen con sus secciones y la fuente', () => {
    render(
      <TarjetaResumen
        tarjeta={{
          tipo: 'resumen',
          titulo: 'Solicitud #104 · Ignacio Paredes Soto',
          lineas: ['Cargo: Técnico Eléctrico', 'Próximo paso: Agendar la entrevista.'],
          secciones: [{ titulo: 'Brechas del CV', lineas: ['2 años de experiencia'] }],
          fuente: 'Solicitudes · Planner',
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Solicitud #104 · Ignacio Paredes Soto' })).toBeInTheDocument();
    expect(screen.getByText('Cargo: Técnico Eléctrico')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Brechas del CV' })).toBeInTheDocument();
    expect(screen.getByText('Fuente: Solicitudes · Planner')).toBeInTheDocument();
  });

  it('muestra el ranking de postulantes con su % y su brecha principal', () => {
    render(
      <TarjetaResumen
        tarjeta={{
          tipo: 'ranking',
          cargo: 'Técnico Eléctrico',
          postulantes: [
            { candidatoId: 1, nombre: 'Ana Pérez', porcentaje: 90, brecha: '' },
            { candidatoId: 2, nombre: 'Luis Soto', porcentaje: 55, brecha: 'Licencia clase B' },
          ],
          nota: 'La decisión es tuya.',
        }}
      />,
    );
    const filas = screen.getAllByRole('listitem');
    expect(filas[0]).toHaveTextContent('Ana Pérez');
    expect(filas[0]).toHaveTextContent('90%');
    expect(filas[1]).toHaveTextContent('Brecha: Licencia clase B');
    expect(screen.getByText('La decisión es tuya.')).toBeInTheDocument();
  });
});
