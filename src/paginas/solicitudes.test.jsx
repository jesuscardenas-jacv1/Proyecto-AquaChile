import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import NuevaSolicitud from './NuevaSolicitud';
import Solicitudes from './Solicitudes';
import { ProveedorDatos } from '../datos/DatosContext';
import { datosDePrueba, datosVacios } from '../pruebas/utilidades';

const DetalleFalso = () => {
  const { id } = useParams();
  return <h1>Detalle de solicitud #{id}</h1>;
};

const renderNueva = (datosIniciales) =>
  render(
    <MemoryRouter initialEntries={['/solicitudes/nueva']}>
      <ProveedorDatos datosIniciales={structuredClone(datosIniciales)}>
        <Routes>
          <Route path="/solicitudes/nueva" element={<NuevaSolicitud />} />
          <Route path="/solicitudes/:id" element={<DetalleFalso />} />
          <Route path="/candidatos/nuevo" element={<h1>Formulario nuevo candidato</h1>} />
        </Routes>
      </ProveedorDatos>
    </MemoryRouter>,
  );

const renderListado = (datosIniciales = datosDePrueba) =>
  render(
    <MemoryRouter initialEntries={['/solicitudes']}>
      <ProveedorDatos datosIniciales={structuredClone(datosIniciales)}>
        <Routes>
          <Route path="/solicitudes" element={<Solicitudes />} />
          <Route path="/solicitudes/nueva" element={<h1>Formulario nueva solicitud</h1>} />
        </Routes>
      </ProveedorDatos>
    </MemoryRouter>,
  );

describe('NuevaSolicitud', () => {
  it('crea la solicitud y navega al detalle', async () => {
    const usuario = userEvent.setup();
    renderNueva(datosDePrueba);

    await usuario.selectOptions(screen.getByLabelText(/candidato/i), '1');
    await usuario.click(screen.getByRole('button', { name: /crear solicitud/i }));

    expect(screen.getByRole('heading', { name: /detalle de solicitud #4/i })).toBeInTheDocument();
  });

  it('advierte cuando no hay candidatos registrados', () => {
    renderNueva(datosVacios);
    expect(screen.getByText('Sin candidatos registrados')).toBeInTheDocument();
  });

  it('permite ir al registro de candidatos', async () => {
    const usuario = userEvent.setup();
    renderNueva(datosVacios);

    await usuario.click(screen.getByRole('button', { name: /registrar candidato/i }));
    expect(
      screen.getByRole('heading', { name: /formulario nuevo candidato/i }),
    ).toBeInTheDocument();
  });
});

describe('Solicitudes', () => {
  it('muestra el total de solicitudes', () => {
    renderListado();
    expect(screen.getByText(/3 solicitudes registradas/)).toBeInTheDocument();
  });

  it('usa el singular cuando hay una sola solicitud', () => {
    renderListado({ ...datosDePrueba, solicitudes: [datosDePrueba.solicitudes[0]] });
    expect(screen.getByText(/1 solicitud registrada/)).toBeInTheDocument();
  });

  it('navega al formulario de nueva solicitud', async () => {
    const usuario = userEvent.setup();
    renderListado();

    await usuario.click(screen.getByRole('button', { name: /nueva solicitud/i }));
    expect(
      screen.getByRole('heading', { name: /formulario nueva solicitud/i }),
    ).toBeInTheDocument();
  });
});
