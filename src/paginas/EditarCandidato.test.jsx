import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EditarCandidato from './EditarCandidato';
import { ProveedorDatos } from '../datos/DatosContext';
import { datosDePrueba } from '../pruebas/utilidades';

const renderPagina = (id = '1') =>
  render(
    <MemoryRouter initialEntries={[`/candidatos/${id}/editar`]}>
      <ProveedorDatos datosIniciales={structuredClone(datosDePrueba)}>
        <Routes>
          <Route path="/candidatos/:id/editar" element={<EditarCandidato />} />
          <Route path="/candidatos" element={<h1>Listado de candidatos</h1>} />
        </Routes>
      </ProveedorDatos>
    </MemoryRouter>,
  );

describe('EditarCandidato', () => {
  it('precarga los datos del candidato', () => {
    renderPagina('1');
    expect(screen.getByRole('heading', { name: /editar candidato/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre completo/i)).toHaveValue('María González');
    expect(screen.getByLabelText(/^cargo/i)).toHaveValue('Técnico de Planta');
  });

  it('actualiza el candidato y regresa al listado', async () => {
    const usuario = userEvent.setup();
    renderPagina('1');

    await usuario.clear(screen.getByLabelText(/nombre completo/i));
    await usuario.type(screen.getByLabelText(/nombre completo/i), 'María González Soto');
    await usuario.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(screen.getByRole('heading', { name: /listado de candidatos/i })).toBeInTheDocument();
  });

  it('informa cuando el candidato no existe', () => {
    renderPagina('99');
    expect(screen.getByText('Candidato no encontrado')).toBeInTheDocument();
  });
});
