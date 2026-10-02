import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import NuevaSolicitud from './NuevaSolicitud';
import Solicitudes from './Solicitudes';
import { ProveedorDatos, useDatos } from '../datos/DatosContext';
import { datosDePrueba, datosVacios } from '../pruebas/utilidades';

const DetalleFalso = () => {
  const { id } = useParams();
  const { obtenerSolicitud, obtenerCandidato } = useDatos();
  const candidato = obtenerCandidato(obtenerSolicitud(id)?.candidatoId);
  return (
    <>
      <h1>Detalle de solicitud #{id}</h1>
      <p>Candidato: {candidato?.nombre}</p>
    </>
  );
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

const renderListado = (datosIniciales = datosDePrueba, ruta = '/solicitudes') =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorDatos datosIniciales={structuredClone(datosIniciales)}>
        <Routes>
          <Route path="/solicitudes" element={<Solicitudes />} />
          <Route path="/solicitudes/nueva" element={<h1>Formulario nueva solicitud</h1>} />
        </Routes>
      </ProveedorDatos>
    </MemoryRouter>,
  );

const elegir = (usuario, nombreGrupo, opcion) =>
  usuario.click(
    within(screen.getByRole('group', { name: nombreGrupo })).getByRole('radio', { name: opcion }),
  );

async function completarSolicitud(usuario, nombreCandidato) {
  await elegir(usuario, /reclutador/i, 'Carolina Muñoz');
  await usuario.type(screen.getByLabelText(/nombre del candidato/i), nombreCandidato);
  await usuario.type(screen.getByLabelText(/ubicación del cargo/i), 'Oficina Central');
  await usuario.type(screen.getByLabelText(/^ceco/i), 'A170010311');
  await elegir(usuario, /requiere referencias/i, 'Sí');
}

describe('NuevaSolicitud', () => {
  it('crea la solicitud de un candidato registrado y navega al detalle', async () => {
    const usuario = userEvent.setup();
    renderNueva(datosDePrueba);

    await completarSolicitud(usuario, 'María González');
    await elegir(usuario, /origen/i, 'Interno');
    await usuario.click(screen.getByRole('button', { name: /enviar solicitud/i }));

    expect(screen.getByRole('heading', { name: /detalle de solicitud #4/i })).toBeInTheDocument();
    expect(screen.getByText('Candidato: María González')).toBeInTheDocument();
  });

  it('registra al candidato nuevo junto con la solicitud', async () => {
    const usuario = userEvent.setup();
    renderNueva(datosVacios);

    await completarSolicitud(usuario, 'Pedro Soto');
    await usuario.type(screen.getByLabelText(/correo del candidato/i), 'pedro@correo.cl');
    await usuario.type(screen.getByLabelText(/teléfono del candidato/i), '+56911112222');
    await elegir(usuario, /origen/i, 'Externo');
    await usuario.type(screen.getByLabelText(/nombre del cargo/i), 'Jefe de Centro');
    await usuario.click(screen.getByRole('button', { name: /enviar solicitud/i }));

    expect(screen.getByRole('heading', { name: /detalle de solicitud #1/i })).toBeInTheDocument();
    expect(screen.getByText('Candidato: Pedro Soto')).toBeInTheDocument();
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

  it('aplica el filtro de estado recibido en la URL', () => {
    renderListado(datosDePrueba, '/solicitudes?estado=En%20proceso');
    expect(screen.getByLabelText(/^estado$/i)).toHaveValue('En proceso');
  });

  it('ignora un estado desconocido en la URL', () => {
    renderListado(datosDePrueba, '/solicitudes?estado=Inventado');
    expect(screen.getByLabelText(/^estado$/i)).toHaveValue('');
  });
});
