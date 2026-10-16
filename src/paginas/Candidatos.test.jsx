import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Candidatos from './Candidatos';
import { ProveedorDatos } from '../datos/DatosContext';
import { ProveedorAuth } from '../datos/AuthContext';
import { datosDePrueba, datosVacios, USUARIO_TEST_DEFAULT } from '../pruebas/utilidades';

const renderPagina = (
  datosIniciales,
  ruta = '/candidatos',
  estado = undefined,
  usuario = USUARIO_TEST_DEFAULT,
) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: ruta, state: estado }]}>
      <ProveedorAuth usuarioInicial={usuario}>
        <ProveedorDatos datosIniciales={structuredClone(datosIniciales)}>
          <Routes>
            <Route path="/candidatos" element={<Candidatos />} />
            <Route path="/candidatos/nuevo" element={<h1>Formulario nuevo candidato</h1>} />
            <Route path="/candidatos/:id/editar" element={<h1>Formulario edición</h1>} />
          </Routes>
        </ProveedorDatos>
      </ProveedorAuth>
    </MemoryRouter>,
  );

describe('Candidatos', () => {
  it('muestra el total de candidatos registrados', () => {
    renderPagina(datosDePrueba);
    expect(screen.getByText(/2 de 2 registrados/)).toBeInTheDocument();
  });

  it('muestra el mensaje de éxito recibido por navegación', () => {
    renderPagina(datosDePrueba, '/candidatos', {
      mensaje: 'Candidato registrado correctamente.',
      tipo: 'success',
    });
    expect(screen.getByText('Candidato registrado correctamente.')).toBeInTheDocument();
  });

  it('permite cerrar el mensaje de éxito', async () => {
    const usuario = userEvent.setup();
    renderPagina(datosDePrueba, '/candidatos', { mensaje: 'Candidato registrado.' });

    await usuario.click(screen.getByRole('button', { name: /cerrar mensaje/i }));
    expect(screen.queryByText('Candidato registrado.')).toBeNull();
  });

  it('pide confirmación antes de eliminar un candidato', async () => {
    const usuario = userEvent.setup();
    renderPagina(datosDePrueba);

    await usuario.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
    expect(screen.getByText(/¿Eliminar a María González\?/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(screen.getByText(/2 de 2 registrados/)).toBeInTheDocument();
  });

  it('elimina al confirmar un candidato sin solicitudes', async () => {
    const usuario = userEvent.setup();
    // Sin solicitudes ningún candidato tiene registros asociados
    renderPagina({ ...datosDePrueba, solicitudes: [], evaluaciones: [] });

    await usuario.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
    await usuario.click(screen.getByRole('button', { name: /sí, eliminar/i }));

    expect(screen.getByText(/1 de 1 registrados/)).toBeInTheDocument();
  });

  it('no elimina un candidato con solicitudes y explica el motivo', async () => {
    const usuario = userEvent.setup();
    renderPagina(datosDePrueba);

    await usuario.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
    await usuario.click(screen.getByRole('button', { name: /sí, eliminar/i }));

    expect(screen.getByText(/no se puede eliminar/i)).toBeInTheDocument();
    expect(screen.getByText(/2 de 2 registrados/)).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /cerrar mensaje/i }));
    expect(screen.queryByText(/no se puede eliminar/i)).toBeNull();
  });

  it('invita a registrar un candidato cuando el listado está vacío', () => {
    renderPagina(datosVacios);
    expect(screen.getByText('Aún no hay candidatos registrados en el sistema.')).toBeInTheDocument();
  });

  it('navega al formulario de edición', async () => {
    const usuario = userEvent.setup();
    renderPagina(datosDePrueba);

    await usuario.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    expect(screen.getByRole('heading', { name: /formulario edición/i })).toBeInTheDocument();
  });

  it('navega al formulario de registro', async () => {
    const usuario = userEvent.setup();
    renderPagina(datosDePrueba);

    await usuario.click(screen.getByRole('button', { name: /nuevo candidato/i }));
    expect(
      screen.getByRole('heading', { name: /formulario nuevo candidato/i }),
    ).toBeInTheDocument();
  });

  it('la evaluadora consulta candidatos pero no puede crearlos, editarlos ni eliminarlos', () => {
    renderPagina(datosDePrueba, '/candidatos', undefined, {
      id: 2,
      nombre: 'Evaluadora',
      correo: 'evaluador@aquachile.cl',
      rol: 'evaluador',
    });

    expect(screen.getByText(/2 de 2 registrados/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eliminar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
    expect(screen.queryByRole('button', { name: /nuevo candidato/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /nuevo candidato/i })).toBeNull();
  });
});
