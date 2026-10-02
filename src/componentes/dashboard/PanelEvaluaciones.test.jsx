import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import PanelEvaluaciones from './PanelEvaluaciones';

const solicitudes = [
  { id: 1, familiaCargo: 'Técnico B C', profesionalResponsable: 'Carolina Muñoz', tipoEvaluacion: 'externa' },
  { id: 2, familiaCargo: 'Jefatura', profesionalResponsable: 'Javiera Soto', tipoEvaluacion: 'interna' },
  { id: 3, familiaCargo: 'Jefatura', profesionalResponsable: 'Javiera Soto', tipoEvaluacion: 'interna' },
];

const evaluaciones = [
  { solicitudId: 1, resultado: 'Recomendado', fechaEvaluacion: '2026-03-04', diasRespuesta: 2 },
  { solicitudId: 2, resultado: 'No recomendado', fechaEvaluacion: '2026-04-20', diasRespuesta: 4 },
  { solicitudId: 3, resultado: 'Recomendado', fechaEvaluacion: '2026-04-22', diasRespuesta: 6 },
];

const renderPanel = () =>
  render(<PanelEvaluaciones solicitudes={solicitudes} evaluaciones={evaluaciones} />);

const tablaDe = (region) => within(screen.getByRole('region', { name: region }));

describe('PanelEvaluaciones', () => {
  it('muestra las métricas de todos los candidatos evaluados', () => {
    renderPanel();

    expect(screen.getByText('3 evaluaciones con resultado.')).toBeInTheDocument();
    const categorias = tablaDe('Categoría de candidatos evaluados');
    expect(categorias.getByRole('cell', { name: '67%' })).toBeInTheDocument();

    const reclutadores = tablaDe('Candidatos evaluados por reclutador');
    expect(reclutadores.getByRole('row', { name: 'Javiera Soto 2' })).toBeInTheDocument();
    expect(reclutadores.getByRole('row', { name: 'Total 3' })).toBeInTheDocument();

    expect(screen.getByRole('img', { name: /promedio de timing: 4 días hábiles/i })).toBeInTheDocument();
  });

  it('aplica los filtros de mes y tipo de evaluación a todos los gráficos', async () => {
    const usuario = userEvent.setup();
    renderPanel();

    await usuario.selectOptions(screen.getByLabelText(/filtrar por mes/i), '2026-04');
    expect(screen.getByText(/2 evaluaciones con resultado para los filtros/)).toBeInTheDocument();

    await usuario.selectOptions(screen.getByLabelText(/filtrar por tipo de evaluación/i), 'externa');
    expect(
      screen.getAllByText('Sin evaluaciones para los filtros seleccionados.').length,
    ).toBeGreaterThan(0);

    await usuario.selectOptions(screen.getByLabelText(/filtrar por mes/i), '');
    const familias = tablaDe('Recuento de candidatos evaluados por familia de cargo');
    expect(familias.getByRole('row', { name: 'Técnico B C 1 0 1' })).toBeInTheDocument();
    expect(familias.queryByRole('row', { name: /jefatura/i })).toBeNull();
    expect(screen.getByRole('img', { name: /promedio de timing: 2 días hábiles/i })).toBeInTheDocument();
  });
});
