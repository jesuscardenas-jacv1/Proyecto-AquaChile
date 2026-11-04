import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CampanaNotificaciones from './CampanaNotificaciones';

const aviso = (cambios = {}) => ({
  id: 1,
  tipo: 'postulacion',
  mensaje: 'Nueva postulación: Ana Pérez a Monitor',
  enlace: '/postulaciones',
  leida: false,
  creadaEn: '2026-11-04 10:00:00',
  ...cambios,
});
const crearApi = (notificaciones = [aviso()]) => ({
  listar: vi.fn().mockResolvedValue({
    noLeidas: notificaciones.filter((n) => !n.leida).length,
    notificaciones,
  }),
  marcarLeida: vi.fn().mockResolvedValue({}),
  marcarTodas: vi.fn().mockResolvedValue({}),
});
const renderCampana = (api, props = {}) =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <CampanaNotificaciones api={api} {...props} />
      <Routes>
        <Route path="/" element={<h1>Inicio</h1>} />
        <Route path="/postulaciones" element={<h1>Bandeja</h1>} />
      </Routes>
    </MemoryRouter>,
  );

describe('CampanaNotificaciones', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('aquachile_token_api', 'jwt');
  });

  it('sin sesión en el servidor no se muestra ni consulta', () => {
    sessionStorage.clear();
    const api = crearApi();
    renderCampana(api);
    expect(screen.queryByRole('button', { name: /notificaciones/i })).toBeNull();
    expect(api.listar).not.toHaveBeenCalled();
  });

  it('muestra el contador y al abrir un aviso lo marca y lleva a su pantalla', async () => {
    const usuario = userEvent.setup();
    const api = crearApi();
    renderCampana(api);

    await usuario.click(await screen.findByRole('button', { name: 'Notificaciones: 1 sin leer' }));
    const ventana = screen.getByRole('dialog', { name: 'Notificaciones' });
    await usuario.click(within(ventana).getByRole('button', { name: /Ana Pérez a Monitor/ }));

    expect(screen.getByRole('heading', { name: 'Bandeja' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.marcarLeida).toHaveBeenCalledWith(1);
  });

  it('un aviso ya leído no se vuelve a marcar', async () => {
    const usuario = userEvent.setup();
    const api = crearApi([aviso({ leida: true })]);
    renderCampana(api);
    await waitFor(() => expect(api.listar).toHaveBeenCalled());
    await usuario.click(screen.getByRole('button', { name: 'Notificaciones' }));
    await usuario.click(screen.getByRole('button', { name: /Ana Pérez a Monitor/ }));
    expect(api.marcarLeida).not.toHaveBeenCalled();
  });

  it('marca todas como leídas y vuelve a consultar', async () => {
    const usuario = userEvent.setup();
    const api = crearApi();
    renderCampana(api);
    await usuario.click(await screen.findByRole('button', { name: 'Notificaciones: 1 sin leer' }));
    api.listar.mockResolvedValue({ noLeidas: 0, notificaciones: [aviso({ leida: true })] });
    await usuario.click(screen.getByRole('button', { name: 'Marcar todas como leídas' }));

    expect(api.marcarTodas).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Marcar todas como leídas' })).toBeNull());
  });

  it('avisa lo nuevo sin recargar y conserva lo cargado si falla la conexión', async () => {
    const api = crearApi([]);
    renderCampana(api, { intervalo: 20 });
    await screen.findByRole('button', { name: 'Notificaciones' });

    api.listar.mockResolvedValue({ noLeidas: 12, notificaciones: [aviso()] });
    expect(await screen.findByRole('button', { name: 'Notificaciones: 12 sin leer' })).toHaveTextContent('9+');

    api.listar.mockRejectedValue(new Error('Sin conexión'));
    await new Promise((resolver) => setTimeout(resolver, 60));
    expect(screen.getByRole('button', { name: 'Notificaciones: 12 sin leer' })).toBeInTheDocument();
  });

  it('sin avisos lo indica', async () => {
    const usuario = userEvent.setup();
    renderCampana(crearApi([]));
    await usuario.click(await screen.findByRole('button', { name: 'Notificaciones' }));
    expect(screen.getByText('No tienes notificaciones.')).toBeInTheDocument();
  });
});
