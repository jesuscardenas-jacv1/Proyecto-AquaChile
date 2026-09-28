import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { ProveedorDatos } from './datos/DatosContext';
import { datosDePrueba } from './pruebas/utilidades';

const renderApp = (ruta) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorDatos datosIniciales={structuredClone(datosDePrueba)}>
        <App />
      </ProveedorDatos>
    </MemoryRouter>,
  );

describe('App (enrutado)', () => {
  it('muestra el dashboard en la raíz', () => {
    renderApp('/');
    expect(screen.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Solicitudes totales')).toBeInTheDocument();
  });

  it('navega entre el dashboard y el listado de solicitudes', async () => {
    const usuario = userEvent.setup();
    renderApp('/');

    await usuario.click(screen.getByRole('link', { name: 'Solicitudes' }));
    expect(screen.getByRole('heading', { name: 'Solicitudes', level: 1 })).toBeInTheDocument();
  });

  it('muestra el listado de candidatos', async () => {
    const usuario = userEvent.setup();
    renderApp('/');

    await usuario.click(screen.getByRole('link', { name: 'Candidatos' }));
    expect(screen.getByRole('heading', { name: 'Candidatos', level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText('maria.gonzalez@correo.cl').length).toBeGreaterThan(0);
  });

  it('muestra el formulario de registro de candidato', () => {
    renderApp('/candidatos/nuevo');
    expect(screen.getByRole('heading', { name: /registrar candidato/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre completo/i)).toBeInTheDocument();
  });

  it('muestra el detalle de la solicitud solicitada', () => {
    renderApp('/solicitudes/1');
    expect(screen.getByRole('heading', { name: /solicitud #1/i })).toBeInTheDocument();
    expect(screen.getAllByText('Recomendado').length).toBeGreaterThan(0);
  });

  it('muestra la página 404 para rutas desconocidas', () => {
    renderApp('/ruta-inexistente');
    expect(screen.getByText('Página no encontrada')).toBeInTheDocument();
  });
});
