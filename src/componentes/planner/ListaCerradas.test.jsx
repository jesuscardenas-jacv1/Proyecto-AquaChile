import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ListaCerradas from './ListaCerradas';

const cerrada = {
  id: 7,
  candidatoId: 3,
  cargo: 'Monitor Producción',
  cierre: { motivo: 'Desistió del proceso', comentario: 'Aceptó otra oferta.', fecha: '2026-10-20', responsable: 'Ignacia Valdés Ortiz' },
};
const renderLista = (props) =>
  render(
    <MemoryRouter>
      <ListaCerradas solicitudes={[cerrada]} candidatosPorId={{ 3: { nombre: 'Luis Soto' } }} {...props} />
    </MemoryRouter>,
  );

describe('ListaCerradas', () => {
  it('no se muestra si no hay cerradas', () => {
    const { container } = render(<ListaCerradas solicitudes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('parte plegada y al abrirla muestra motivo, fecha, quién cerró y permite reabrir', async () => {
    const usuario = userEvent.setup();
    const alReabrir = vi.fn();
    renderLista({ editable: true, alReabrir });
    expect(screen.queryByText('Luis Soto')).toBeNull();

    await usuario.click(screen.getByRole('button', { name: /cerradas sin informe/i }));
    expect(screen.getByText('Desistió del proceso')).toBeInTheDocument();
    expect(screen.getByText(/20-10-2026 · Ignacia Valdés Ortiz/)).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Reabrir la solicitud de Luis Soto' }));
    expect(alReabrir).toHaveBeenCalledWith(cerrada);
  });

  it('en solo lectura no ofrece reabrir', async () => {
    const usuario = userEvent.setup();
    renderLista({ editable: false });
    await usuario.click(screen.getByRole('button', { name: /cerradas sin informe/i }));
    expect(screen.queryByRole('button', { name: /reabrir/i })).toBeNull();
  });
});
