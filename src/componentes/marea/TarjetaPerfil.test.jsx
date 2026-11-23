import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TarjetaPerfil from './TarjetaPerfil';

const tarjeta = {
  tipo: 'perfil', nombre: 'Ignacia Pérez Lagos', ciudad: 'Puerto Montt', aniosExperiencia: 4, resumen: 'Ingeniera en control de gestión.',
  habilidades: [{ habilidad: 'Power BI', categoria: 'herramienta', evidencia: 'Tableros' }],
  experiencia: [{ cargo: 'Analista', empresa: 'Empresa de ejemplo', desde: '2022', hasta: '2026' }],
  formacion: [{ titulo: 'Ingeniería', institucion: 'Universidad de ejemplo', estado: 'Titulada' }],
  idiomas: [], demostracion: false, nota: 'Extraído del CV: confírmalo en la entrevista.',
};

describe('TarjetaPerfil', () => {
  it('muestra el perfil profesional', () => {
    render(<TarjetaPerfil tarjeta={tarjeta} />);
    expect(screen.getByText('Puerto Montt, 4 años de experiencia')).toBeInTheDocument();
    expect(screen.getByText('Power BI')).toHaveAttribute('title', 'Tableros');
    expect(screen.getByText(/2022 a 2026/)).toBeInTheDocument();
    expect(screen.getByText('Ingeniería, Universidad de ejemplo, Titulada')).toBeInTheDocument();
    expect(screen.getByText(/confírmalo en la entrevista/)).toBeInTheDocument();
  });

  it('omite las secciones vacías y avisa si es de demostración', () => {
    render(<TarjetaPerfil tarjeta={{ ...tarjeta, aniosExperiencia: null, habilidades: [], experiencia: [], formacion: [], demostracion: true }} />);
    expect(screen.queryByText('Habilidades')).toBeNull();
    expect(screen.queryByText('Experiencia')).toBeNull();
    expect(screen.getByText('Perfil ficticio de demostración.')).toBeInTheDocument();
  });
});
