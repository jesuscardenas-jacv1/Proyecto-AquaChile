import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CampanaMarea from './CampanaMarea';

const aviso = {
  id: 7,
  tipo: 'postulacion',
  mensaje: 'Nueva postulación: Ana Pérez a Técnico Eléctrico',
  leida: false,
  creadaEn: '2026-11-19 10:00:00',
  postulacionId: 3,
  acciones: [{ etiqueta: 'Analizar y agendar', accion: { tipo: 'analizar_candidato', postulacionId: 3, tambienAgendar: true } }],
};
const crearApi = (avisos = [aviso]) => ({
  avisos: vi.fn().mockResolvedValue({ noLeidas: avisos.filter((a) => !a.leida).length, avisos }),
  marcarTodos: vi.fn().mockResolvedValue({}),
});

describe('CampanaMarea', () => {
  it('lista los avisos con sus acciones y avisa al usar una', async () => {
    const alUsar = vi.fn();
    render(<CampanaMarea api={crearApi()} alUsar={alUsar} alCambiar={vi.fn()} />);
    expect(await screen.findByText(aviso.mensaje)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Analizar y agendar' }));
    expect(alUsar).toHaveBeenCalledWith(aviso, aviso.acciones[0]);
  });

  it('marca todos como leídos', async () => {
    const api = crearApi();
    const alCambiar = vi.fn();
    render(<CampanaMarea api={api} alUsar={vi.fn()} alCambiar={alCambiar} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Marcar todo como leído' }));
    expect(api.marcarTodos).toHaveBeenCalled();
    await waitFor(() => expect(alCambiar).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Marcar todo como leído' })).toBeNull();
  });

  it('sin avisos lo dice, y si falla muestra el error', async () => {
    const { unmount } = render(<CampanaMarea api={crearApi([])} alUsar={vi.fn()} alCambiar={vi.fn()} />);
    expect(await screen.findByText('No tienes avisos.')).toBeInTheDocument();
    unmount();
    const api = { avisos: vi.fn().mockRejectedValue(new Error('Sin conexión')), marcarTodos: vi.fn() };
    render(<CampanaMarea api={api} alUsar={vi.fn()} alCambiar={vi.fn()} />);
    expect(await screen.findByText('Sin conexión')).toBeInTheDocument();
  });
});
