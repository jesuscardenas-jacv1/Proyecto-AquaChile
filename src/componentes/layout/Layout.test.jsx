import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Layout from './Layout';
import { ProveedorAuth } from '../../datos/AuthContext';
import { ProveedorDatos } from '../../datos/DatosContext';
import { ErrorApi } from '../../servicios/errores';
import { datosDePrueba, USUARIO_TEST_DEFAULT } from '../../pruebas/utilidades';

/** Servicio remoto mínimo: solo lo que el Layout necesita para cargar. */
const servicioRemoto = (cargarDatos) => ({ modo: 'api', cargarDatos, iniciarSesion: vi.fn() });

const renderLayout = (servicio) =>
  render(
    <MemoryRouter>
      <ProveedorAuth usuarioInicial={USUARIO_TEST_DEFAULT} servicio={servicio}>
        <ProveedorDatos servicio={servicio}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<h1>Contenido de la página</h1>} />
            </Route>
          </Routes>
        </ProveedorDatos>
      </ProveedorAuth>
    </MemoryRouter>,
  );

describe('Layout', () => {
  it('muestra "Cargando datos" mientras responde la API y luego la página', async () => {
    let resolver;
    const servicio = servicioRemoto(
      vi.fn(
        () =>
          new Promise((r) => {
            resolver = r;
          }),
      ),
    );
    renderLayout(servicio);

    expect(screen.getByText(/cargando datos/i)).toBeInTheDocument();
    expect(screen.queryByText('Contenido de la página')).toBeNull();

    resolver(structuredClone(datosDePrueba));
    expect(await screen.findByText('Contenido de la página')).toBeInTheDocument();
  });

  it('muestra el error de conexión y permite reintentar', async () => {
    const usuario = userEvent.setup();
    const cargarDatos = vi
      .fn()
      .mockRejectedValueOnce(new ErrorApi(0, 'No se pudo conectar con el servidor.'))
      .mockResolvedValueOnce(structuredClone(datosDePrueba));
    renderLayout(servicioRemoto(cargarDatos));

    expect(await screen.findByText('No se pudieron cargar los datos')).toBeInTheDocument();
    expect(screen.getByText(/no se pudo conectar/i)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByText('Contenido de la página')).toBeInTheDocument());
    expect(cargarDatos).toHaveBeenCalledTimes(2);
  });
});
