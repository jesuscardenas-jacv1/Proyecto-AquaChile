import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BarraMarea from './BarraMarea';
import { suscribirTiempoReal } from '../../servicios/tiempoReal';

const sesion = { usuarioActual: { id: 2, nombre: 'Ignacia Valdés Ortiz', rol: 'evaluador' }, modo: 'api' };
vi.mock('../../datos/AuthContext', () => ({ useAuth: () => ({ usuarioActual: sesion.usuarioActual }) }));
vi.mock('../../datos/DatosContext', () => ({ useDatos: () => ({ modo: sesion.modo }) }));
vi.mock('../../servicios/tiempoReal', () => ({ suscribirTiempoReal: vi.fn(() => () => {}) }));

const crearApi = (noLeidas = 0) => ({
  avisos: vi.fn().mockResolvedValue({ noLeidas, avisos: [] }),
  enviar: vi.fn().mockResolvedValue({ texto: 'Hola', tarjetas: [], opciones: [], foco: null }),
});
const renderBarra = (api, ruta = '/planner') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <BarraMarea api={api} />
    </MemoryRouter>,
  );

describe('BarraMarea', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('aquachile_token_api', 'jwt');
    localStorage.clear();
    sesion.modo = 'api';
  });

  it('en modo local (sin servidor) no se muestra', () => {
    sesion.modo = 'local';
    const api = crearApi();
    renderBarra(api);
    expect(screen.queryByRole('button', { name: /Abrir Marea/ })).toBeNull();
    expect(api.avisos).not.toHaveBeenCalled();
  });

  it('muestra el módulo actual y la insignia de avisos nuevos', async () => {
    renderBarra(crearApi(3));
    const barra = await screen.findByRole('button', { name: /Abrir Marea.*3 avisos nuevos/ });
    expect(barra).toHaveTextContent('Planner');
    expect(barra).toHaveTextContent('3nuevos');
  });

  it('se abre con un clic y con Ctrl K, y Esc la cierra', async () => {
    const usuario = userEvent.setup();
    renderBarra(crearApi());
    await usuario.click(await screen.findByRole('button', { name: /Abrir Marea/ }));
    expect(screen.getByRole('dialog', { name: 'Marea' })).toBeInTheDocument();

    await usuario.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: /Abrir Marea/ })).toHaveFocus());

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(await screen.findByRole('dialog', { name: 'Marea' })).toBeInTheDocument();
  });

  it('recuerda el tema oscuro', async () => {
    const usuario = userEvent.setup();
    renderBarra(crearApi());
    await usuario.click(await screen.findByRole('button', { name: /Abrir Marea/ }));
    await usuario.click(screen.getByRole('button', { name: /Oscuro/ }));
    expect(localStorage.getItem('marea-tema')).toBe('oscuro');
    expect(screen.getByRole('button', { name: /Abrir Marea/, hidden: true })).toHaveClass('marea-tema-oscuro');
  });

  it('actualiza la insignia cuando llega un aviso en tiempo real', async () => {
    const api = crearApi(0);
    renderBarra(api);
    await waitFor(() => expect(api.avisos).toHaveBeenCalledTimes(1));
    const [[tipo, oyente]] = suscribirTiempoReal.mock.calls;
    expect(tipo).toBe('notificacion');
    api.avisos.mockResolvedValue({ noLeidas: 1, avisos: [] });
    oyente();
    expect(await screen.findByRole('button', { name: /1 avisos nuevos/ })).toBeInTheDocument();
  });
});
