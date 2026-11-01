import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SeccionCompetencias from './SeccionCompetencias';
import { COMPETENCIAS } from '../../datos/constantes';

describe('SeccionCompetencias', () => {
  it('lista todas las competencias del catálogo sin evaluar', () => {
    render(<SeccionCompetencias competencias={[]} alCambiar={vi.fn()} />);
    COMPETENCIAS.forEach((competencia) => {
      expect(screen.getByRole('checkbox', { name: competencia })).not.toBeChecked();
    });
    expect(screen.queryByLabelText(/nivel/i)).toBeNull();
  });

  it('al marcar una competencia la agrega vacía y al desmarcarla la quita', async () => {
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    const { rerender } = render(<SeccionCompetencias competencias={[]} alCambiar={alCambiar} />);

    await usuario.click(screen.getByRole('checkbox', { name: 'Liderazgo' }));
    expect(alCambiar).toHaveBeenLastCalledWith([
      { competencia: 'Liderazgo', nivel: '', fortalezas: '', oportunidades: '' },
    ]);

    rerender(
      <SeccionCompetencias
        competencias={[{ competencia: 'Liderazgo', nivel: '', fortalezas: '', oportunidades: '' }]}
        alCambiar={alCambiar}
      />,
    );
    await usuario.click(screen.getByRole('checkbox', { name: 'Liderazgo' }));
    expect(alCambiar).toHaveBeenLastCalledWith([]);
  });

  it('edita nivel y textos de la competencia marcada y muestra su error', async () => {
    const usuario = userEvent.setup();
    const alCambiar = vi.fn();
    render(
      <SeccionCompetencias
        competencias={[{ competencia: 'Trabajo en equipo', nivel: '', fortalezas: '', oportunidades: '' }]}
        alCambiar={alCambiar}
        errores={{ 'competencia:Trabajo en equipo': 'Indique el nivel de "Trabajo en equipo".' }}
      />,
    );

    await usuario.selectOptions(screen.getByLabelText(/nivel/i), 'Esperado');
    expect(alCambiar).toHaveBeenLastCalledWith([
      { competencia: 'Trabajo en equipo', nivel: 'Esperado', fortalezas: '', oportunidades: '' },
    ]);
    expect(screen.getByText('Indique el nivel de "Trabajo en equipo".')).toBeInTheDocument();
  });
});
