import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NuevoCandidato from './NuevoCandidato';
import { ProveedorDatos } from '../datos/DatosContext';
import { datosDePrueba, datosVacios } from '../pruebas/utilidades';
import { crearServicioMemoria } from '../servicios/servicioMemoria';
import { ErrorApi } from '../servicios/errores';

const renderPagina = (datosIniciales, servicio) =>
  render(
    <MemoryRouter initialEntries={['/candidatos/nuevo']}>
      <ProveedorDatos
        servicio={servicio ?? crearServicioMemoria(structuredClone(datosIniciales))}
      >
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

  it('si la API rechaza los datos, muestra el motivo y no sale del formulario', async () => {
    const usuario = userEvent.setup();
    const servicio = crearServicioMemoria(structuredClone(datosDePrueba));
    servicio.crearCandidato = vi.fn().mockRejectedValue(
      new ErrorApi(400, 'Los datos enviados no son válidos.', {
        telefono: 'El teléfono debe contener solo números (8 a 15 dígitos).',
      }),
    );
    renderPagina(datosDePrueba, servicio);

    await completarYEnviar(usuario);

    expect(await screen.findByText('No se pudo registrar el candidato')).toBeInTheDocument();
    expect(screen.getByText(/el teléfono debe contener solo números/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /listado de candidatos/i })).toBeNull();
  });
});
