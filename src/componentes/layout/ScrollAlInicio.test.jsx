import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Link, MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import ScrollAlInicio from './ScrollAlInicio';

function PaginaConFiltro() {
  const [, setParametros] = useSearchParams();
  return (
    <button type="button" onClick={() => setParametros({ pagina: '2' })}>
      Cambiar filtro
    </button>
  );
}

const renderRutas = () =>
  render(
    <MemoryRouter initialEntries={['/planner']}>
      <ScrollAlInicio />
      <Link to="/solicitudes">Ir a solicitudes</Link>
      <Routes>
        <Route path="/planner" element={<PaginaConFiltro />} />
        <Route path="/solicitudes" element={<h1>Solicitudes</h1>} />
      </Routes>
    </MemoryRouter>,
  );

describe('ScrollAlInicio', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
  });

  it('vuelve al inicio al cambiar de página', async () => {
    const usuario = userEvent.setup();
    renderRutas();
    window.scrollTo.mockClear();

    await usuario.click(screen.getByRole('link', { name: 'Ir a solicitudes' }));

    expect(screen.getByRole('heading', { name: 'Solicitudes' })).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('no mueve la página al cambiar solo los filtros de la URL', async () => {
    const usuario = userEvent.setup();
    renderRutas();
    window.scrollTo.mockClear();

    await usuario.click(screen.getByRole('button', { name: 'Cambiar filtro' }));

    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
