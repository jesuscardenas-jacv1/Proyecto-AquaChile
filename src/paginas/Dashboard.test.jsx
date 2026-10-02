import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard';
import { useDatos } from '../datos/DatosContext';
import { useNavigate } from 'react-router-dom';

// Mocks: la página se prueba aislada de la capa de estado y de la navegación.
vi.mock('../datos/DatosContext', () => ({
  useDatos: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, useNavigate: vi.fn() };
});

const datosSimulados = {
  candidatos: [
    { id: 1, nombre: 'María González', correo: 'maria@correo.cl', telefono: '+56912345678', cargo: 'Técnico', familiaCargo: 'Técnico B C' },
    { id: 2, nombre: 'Juan Pérez', correo: 'juan@correo.cl', telefono: '+56987654321', cargo: 'Analista', familiaCargo: 'Profesional A' },
  ],
  solicitudes: [
    { id: 1, candidatoId: 1, cargo: 'Técnico', familiaCargo: 'Técnico B C', fechaSolicitud: '2026-08-03', estado: 'Finalizada', profesionalResponsable: 'Carolina Muñoz', observaciones: '' },
    { id: 2, candidatoId: 2, cargo: 'Analista', familiaCargo: 'Profesional A', fechaSolicitud: '2026-08-17', estado: 'En proceso', profesionalResponsable: '', observaciones: '' },
    { id: 3, candidatoId: 1, cargo: 'Técnico', familiaCargo: 'Técnico B C', fechaSolicitud: '2026-09-01', estado: 'Pendiente', profesionalResponsable: '', observaciones: '' },
  ],
  evaluaciones: [
    { id: 1, solicitudId: 1, fechaEvaluacion: '2026-08-10', resultado: 'Recomendado', observaciones: 'Perfil estable.', estado: 'Realizada' },
  ],
};

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );

describe('Dashboard', () => {
  beforeEach(() => {
    useDatos.mockReturnValue(datosSimulados);
  });

  it('muestra los indicadores principales calculados desde los datos', () => {
    renderDashboard();

    const indicadores = {
      'Candidatos registrados': '2',
      'Solicitudes totales': '3',
      Pendientes: '1',
      'En proceso': '1',
      Finalizadas: '1',
      Evaluaciones: '1',
    };

    Object.entries(indicadores).forEach(([titulo, valor]) => {
      expect(screen.getAllByText(titulo).length).toBeGreaterThan(0);
      // Cada valor se busca dentro de su propia tarjeta para evitar coincidencias ambiguas.
      const tarjeta = screen.getAllByText(titulo)[0].closest('.card');
      expect(within(tarjeta).getByText(valor)).toBeInTheDocument();
    });
    expect(screen.getByText('33% del total')).toBeInTheDocument();
  });

  it('lista las solicitudes recientes ordenadas por fecha', () => {
    renderDashboard();
    const recientes = screen.getByRole('heading', { name: 'Solicitudes recientes' }).closest('.card');
    const filas = within(recientes).getAllByRole('row');
    // encabezado + 3 solicitudes
    expect(filas).toHaveLength(4);
    expect(filas[1]).toHaveTextContent('01-09-2026');
  });

  it('muestra los indicadores de candidatos evaluados', () => {
    renderDashboard();
    expect(screen.getByRole('heading', { name: 'Candidatos evaluados' })).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: 'Recuento de candidatos evaluados por familia de cargo' }),
    ).toBeInTheDocument();
  });

  it('muestra el estado vacío cuando no hay solicitudes', () => {
    useDatos.mockReturnValue({ ...datosSimulados, solicitudes: [], evaluaciones: [] });
    renderDashboard();
    expect(screen.getAllByText('Sin solicitudes').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Sin evaluaciones para los filtros seleccionados.').length,
    ).toBeGreaterThan(0);
  });

  it('abre el detalle de una tarjeta en una ventana emergente y lo cierra con Escape', async () => {
    const usuario = userEvent.setup();
    const navegar = vi.fn();
    useNavigate.mockReturnValue(navegar);
    renderDashboard();

    const tarjeta = screen.getByRole('button', { name: /pendientes/i });
    expect(tarjeta).toHaveAttribute('aria-expanded', 'false');

    await usuario.click(tarjeta);
    expect(tarjeta).toHaveAttribute('aria-expanded', 'true');
    const detalle = screen.getByRole('dialog', { name: 'Detalle: Solicitudes pendientes' });
    expect(detalle).toHaveAttribute('aria-modal', 'true');
    expect(document.body).toHaveClass('modal-open');
    expect(within(detalle).getByText('1 de 3 solicitudes')).toBeInTheDocument();
    expect(within(detalle).getByText('Por profesional responsable')).toBeInTheDocument();
    expect(within(detalle).getByText('Sin asignar')).toBeInTheDocument();

    await usuario.click(within(detalle).getByRole('button', { name: /ver solicitudes pendientes/i }));
    expect(navegar).toHaveBeenCalledWith('/solicitudes?estado=Pendiente');

    await usuario.click(within(detalle).getByRole('button', { name: /maría gonzález/i }));
    expect(navegar).toHaveBeenCalledWith('/solicitudes/3');

    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body).not.toHaveClass('modal-open');
    expect(tarjeta).toHaveFocus();
  });

  it('cierra la ventana emergente al hacer clic fuera del contenido', async () => {
    const usuario = userEvent.setup();
    renderDashboard();

    await usuario.click(screen.getByRole('button', { name: /en proceso/i }));
    const detalle = screen.getByRole('dialog', { name: 'Detalle: Solicitudes en proceso' });
    await usuario.click(within(detalle).getByText('Por familia de cargo'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await usuario.click(detalle);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('muestra los resultados y el tiempo de respuesta en el detalle de evaluaciones', async () => {
    const usuario = userEvent.setup();
    useDatos.mockReturnValue({
      ...datosSimulados,
      evaluaciones: [
        { ...datosSimulados.evaluaciones[0], diasRespuesta: 4 },
        { id: 2, solicitudId: 2, resultado: 'No recomendado', estado: 'Realizada', diasRespuesta: 7 },
      ],
    });
    renderDashboard();

    await usuario.click(screen.getByRole('button', { name: /evaluaciones/i }));
    const detalle = screen.getByRole('dialog', { name: 'Detalle: Evaluaciones' });
    expect(within(detalle).getByText(/promedio: 5\.5 días hábiles/)).toBeInTheDocument();
    expect(within(detalle).getByText('Recomendado')).toBeInTheDocument();
    expect(within(detalle).getByText('No recomendado')).toBeInTheDocument();
  });

  it('muestra el detalle de otra tarjeta y lo cierra con el botón', async () => {
    const usuario = userEvent.setup();
    useDatos.mockReturnValue({
      ...datosSimulados,
      candidatos: datosSimulados.candidatos.map((candidato, indice) => ({
        ...candidato,
        origen: indice === 0 ? 'Interno' : 'Externo',
      })),
    });
    renderDashboard();

    await usuario.click(screen.getByRole('button', { name: /solicitudes totales/i }));
    expect(screen.getByRole('dialog', { name: 'Detalle: Solicitudes totales' })).toBeInTheDocument();
    await usuario.keyboard('{Escape}');

    await usuario.click(screen.getByRole('button', { name: /candidatos registrados/i }));
    const detalle = screen.getByRole('dialog', { name: 'Detalle: Candidatos registrados' });
    expect(within(detalle).getByText('Por origen')).toBeInTheDocument();
    expect(within(detalle).getByText('Interno')).toBeInTheDocument();

    await usuario.click(within(detalle).getByRole('button', { name: 'Cerrar detalle' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('navega a la creación de solicitud', async () => {
    const usuario = userEvent.setup();
    const navegar = vi.fn();
    useNavigate.mockReturnValue(navegar);
    renderDashboard();

    await usuario.click(screen.getAllByRole('button', { name: /nueva solicitud/i })[0]);
    expect(navegar).toHaveBeenCalledWith('/solicitudes/nueva');
  });
});
