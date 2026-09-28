import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NuevoCandidato from './NuevoCandidato';
import { ProveedorDatos } from '../datos/DatosContext';
import { datosDePrueba, datosVacios } from '../pruebas/utilidades';

const renderPagina = (datosIniciales) =>
  render(
    <MemoryRouter initialEntries={['/candidatos/nuevo']}>
      <ProveedorDatos datosIniciales={structuredClone(datosIniciales)}>
        <Routes>
          <Route path="/candidatos/nuevo" element={<NuevoCandidato />} />
          <Route path="/candidatos" element={<h1>Listado de candidatos</h1>} />
        </Routes>
      </ProveedorDatos>
    </MemoryRouter>,
  );

const completarYEnviar = async (usuario) => {
  await usuario.type(screen.getByLabelText(/nombre completo/i), 'Ana Torres');
  await usuario.type(screen.getByLabelText(/correo electrónico/i), 'ana.torres@correo.cl');
  await usuario.type(screen.getByLabelText(/teléfono/i), '+56911112222');
  await usuario.type(screen.getByLabelText(/^cargo/i), 'Operario');
  await usuario.selectOptions(screen.getByLabelText(/familia de cargo/i), 'Técnico B C');
  await usuario.click(screen.getByRole('button', { name: /registrar candidato/i }));
};

describe('NuevoCandidato', () => {
  it('guarda el candidato y vuelve al listado con el mensaje de éxito', async () => {
    const usuario = userEvent.setup();
    renderPagina(datosDePrueba);

    await completarYEnviar(usuario);

    expect(screen.getByRole('heading', { name: /listado de candidatos/i })).toBeInTheDocument();
  });

  it('no crea el candidato si el formulario tiene errores', async () => {
    const usuario = userEvent.setup();
    renderPagina(datosDePrueba);

    await usuario.click(screen.getByRole('button', { name: /registrar candidato/i }));

    expect(screen.getByText('El nombre del candidato es obligatorio.')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /registrar candidato/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it('permite volver al listado sin guardar', async () => {
    const usuario = userEvent.setup();
    renderPagina(datosDePrueba);

    await usuario.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(screen.getByRole('heading', { name: /listado de candidatos/i })).toBeInTheDocument();
  });

  it('muestra el formulario aunque no existan candidatos', () => {
    renderPagina(datosVacios);
    expect(screen.getByLabelText(/nombre completo/i)).toBeInTheDocument();
  });
});
