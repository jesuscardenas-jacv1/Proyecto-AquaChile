import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DetalleSolicitud from './DetalleSolicitud';
import { datosDePrueba } from '../pruebas/utilidades';
import { ProveedorDatos } from '../datos/DatosContext';

const renderDetalle = (id = '3') =>
  render(
    <MemoryRouter initialEntries={[`/solicitudes/${id}`]}>
      <ProveedorDatos datosIniciales={structuredClone(datosDePrueba)}>
        <Routes>
          <Route path="/solicitudes/:id" element={<DetalleSolicitud />} />
          <Route path="/solicitudes" element={<h1>Listado de solicitudes</h1>} />
        </Routes>
      </ProveedorDatos>
    </MemoryRouter>,
  );

describe('DetalleSolicitud', () => {
  it('muestra los datos de la solicitud y del candidato', () => {
    renderDetalle('3');
    expect(screen.getByRole('heading', { name: /solicitud #3/i })).toBeInTheDocument();
    expect(screen.getAllByText('Técnico de Planta').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThan(0);
    expect(screen.getByText('maria.gonzalez@correo.cl')).toBeInTheDocument();
    expect(screen.getByText('Sin asignar')).toBeInTheDocument();
  });

  it('informa cuando la solicitud no existe', () => {
    renderDetalle('99');
    expect(screen.getByText('Solicitud no encontrada')).toBeInTheDocument();
  });

  it('asigna un profesional responsable', async () => {
    const usuario = userEvent.setup();
    renderDetalle('3');

    await usuario.selectOptions(
      screen.getByLabelText(/profesional responsable/i),
      'Javiera Soto',
    );

    expect(screen.getByLabelText(/profesional responsable/i)).toHaveValue('Javiera Soto');
  });

  it('cambia el estado de la solicitud a En proceso', async () => {
    const usuario = userEvent.setup();
    renderDetalle('3');

    await usuario.selectOptions(screen.getByLabelText(/^estado$/i), 'En proceso');

    expect(screen.getByLabelText(/^estado$/i)).toHaveValue('En proceso');
  });

  it('no permite evaluar una solicitud en estado Pendiente', () => {
    renderDetalle('3');
    expect(screen.getByText(/debe estar en estado/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /registrar evaluación/i })).toBeNull();
  });

  it('muestra el formulario de evaluación cuando la solicitud está en proceso', async () => {
    const usuario = userEvent.setup();
    renderDetalle('2');

    expect(screen.getByRole('button', { name: /registrar evaluación/i })).toBeInTheDocument();
    await usuario.click(screen.getByRole('radio', { name: 'Recomendado' }));
  });

  it('muestra la solicitud como Finalizada tras registrar la evaluación', async () => {
    const usuario = userEvent.setup();
    renderDetalle('2');

    await usuario.click(screen.getByRole('radio', { name: 'Recomendado' }));
    await usuario.type(
      screen.getByLabelText(/^observaciones/i),
      'Perfil adecuado para el cargo evaluado.',
    );
    await usuario.click(screen.getByRole('button', { name: /registrar evaluación/i }));

    expect(screen.getByLabelText(/^estado$/i)).toHaveValue('Finalizada');
    expect(screen.queryByRole('button', { name: /guardar cambios/i })).toBeNull();
  });

  it('permite volver al listado de solicitudes', async () => {
    const usuario = userEvent.setup();
    renderDetalle('3');

    await usuario.click(screen.getByRole('button', { name: /volver a solicitudes/i }));
    expect(screen.getByRole('heading', { name: /listado de solicitudes/i })).toBeInTheDocument();
  });
});
