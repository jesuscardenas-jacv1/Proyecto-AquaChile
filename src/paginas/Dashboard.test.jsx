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
    { id: 1, nombre: 'María González', correo: 'maria@correo.cl', telefono: '+56912345678', cargo: 'Técnico', familiaCargo: 'Operaciones' },
    { id: 2, nombre: 'Juan Pérez', correo: 'juan@correo.cl', telefono: '+56987654321', cargo: 'Analista', familiaCargo: 'Tecnología' },
  ],
  solicitudes: [
    { id: 1, candidatoId: 1, cargo: 'Técnico', familiaCargo: 'Operaciones', fechaSolicitud: '2026-08-03', estado: 'Finalizada', profesionalResponsable: 'Camila Rojas', observaciones: '' },
    { id: 2, candidatoId: 2, cargo: 'Analista', familiaCargo: 'Tecnología', fechaSolicitud: '2026-08-17', estado: 'En proceso', profesionalResponsable: '', observaciones: '' },
    { id: 3, candidatoId: 1, cargo: 'Técnico', familiaCargo: 'Operaciones', fechaSolicitud: '2026-09-01', estado: 'Pendiente', profesionalResponsable: '', observaciones: '' },
  ],
  evaluaciones: [
    { id: 1, solicitudId: 1, fechaEvaluacion: '2026-08-10', resultado: 'Aprobado', observaciones: 'Perfil estable.', estado: 'Realizada' },
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
    const filas = screen.getAllByRole('row');
    // encabezado + 3 solicitudes
    expect(filas).toHaveLength(4);
    expect(filas[1]).toHaveTextContent('01-09-2026');
  });

  it('muestra la distribución por familia de cargo', () => {
    renderDashboard();
    expect(screen.getByText('Distribución por familia de cargo')).toBeInTheDocument();
    expect(screen.getByText('Operaciones')).toBeInTheDocument();
    expect(screen.getByText('Tecnología')).toBeInTheDocument();
  });

  it('muestra el estado vacío cuando no hay solicitudes', () => {
    useDatos.mockReturnValue({ ...datosSimulados, solicitudes: [] });
    renderDashboard();
    expect(screen.getAllByText('Sin solicitudes').length).toBeGreaterThan(0);
    expect(screen.getByText('Aún no hay datos para mostrar.')).toBeInTheDocument();
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
