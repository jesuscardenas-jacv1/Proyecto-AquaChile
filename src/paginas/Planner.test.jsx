import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Planner from './Planner';
import { ProveedorDatos } from '../datos/DatosContext';
import { ProveedorAuth } from '../datos/AuthContext';
import { datosDePrueba, USUARIO_TEST_DEFAULT } from '../pruebas/utilidades';

const EVALUADORA = { ...USUARIO_TEST_DEFAULT, rol: 'evaluador', nombre: 'Ignacia Valdés Ortiz' };
const ANALISTA = { ...USUARIO_TEST_DEFAULT, rol: 'analista', nombre: 'Carolina Muñoz' };

// datosDePrueba: #1 María (Finalizada), #2 Juan (En proceso), #3 María (Pendiente).
const renderPlanner = (usuario = EVALUADORA) =>
  render(
    <MemoryRouter initialEntries={['/planner']}>
      <ProveedorAuth usuarioInicial={usuario}>
        <ProveedorDatos datosIniciales={structuredClone(datosDePrueba)}>
          <Routes>
            <Route path="/planner" element={<Planner />} />
            <Route path="/solicitudes/:id" element={<h1>Detalle de la solicitud</h1>} />
            <Route path="/planner/informes" element={<h1>Pantalla de informes</h1>} />
          </Routes>
        </ProveedorDatos>
      </ProveedorAuth>
    </MemoryRouter>,
  );

const elegirOpcion = (usuario, lista, texto) =>
  usuario.click(within(lista).getByRole('option', { name: texto }));

const columna = (titulo) => screen.getByRole('region', { name: new RegExp(titulo, 'i') });

describe('Planner', () => {
  it('muestra las cuatro etapas con sus solicitudes', () => {
    renderPlanner();

    expect(screen.getByRole('heading', { name: 'Planner de evaluaciones' })).toBeInTheDocument();
    expect(within(columna('Evaluación Recibida')).getByText('María González')).toBeInTheDocument();
    expect(within(columna('Entrevista Agendada')).getByText('Juan Pérez')).toBeInTheDocument();
    expect(within(columna('Entrevista Realizada')).getByText(/sin solicitudes/i)).toBeInTheDocument();
    expect(within(columna('Informe enviado')).getByText(/informe enviado el 10-08-2026/i)).toBeInTheDocument();
  });

  it('agenda una entrevista validando los datos', async () => {
    const usuario = userEvent.setup();
    renderPlanner();

    await usuario.click(screen.getByRole('button', { name: /agendar entrevista de maría gonzález/i }));
    const ventana = screen.getByRole('dialog', { name: 'Agendar entrevista' });

    await usuario.click(within(ventana).getByRole('button', { name: /^agendar$/i }));
    expect(within(ventana).getByText('Debe indicar la fecha de la entrevista.')).toBeInTheDocument();
    expect(within(ventana).getByText('Debe indicar la hora de la entrevista.')).toBeInTheDocument();

    await elegirOpcion(usuario, within(ventana).getByRole('listbox', { name: 'Año' }), '2026');
    await elegirOpcion(usuario, within(ventana).getByRole('listbox', { name: 'Mes' }), 'Octubre');
    await elegirOpcion(usuario, within(ventana).getByRole('listbox', { name: 'Día' }), '20');
    await elegirOpcion(usuario, within(ventana).getByRole('listbox', { name: 'Hora' }), '10');
    await elegirOpcion(usuario, within(ventana).getByRole('listbox', { name: 'Minuto' }), '30');
    await usuario.selectOptions(within(ventana).getByLabelText(/modalidad/i), 'Presencial');
    await usuario.click(within(ventana).getByRole('button', { name: /^agendar$/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const agendada = columna('Entrevista Agendada');
    expect(within(agendada).getByText('María González')).toBeInTheDocument();
    expect(within(agendada).getByText(/entrevista coordinada para 20\/10 a las 10:30/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/entrevista agendada: maría gonzález/i);
  });

  it('cierra la ventana de agenda con Escape sin guardar', async () => {
    const usuario = userEvent.setup();
    renderPlanner();

    await usuario.click(screen.getByRole('button', { name: /agendar entrevista de maría gonzález/i }));
    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(columna('Evaluación Recibida')).getByText('María González')).toBeInTheDocument();
  });

  it('marca una entrevista como realizada y permite devolverla', async () => {
    const usuario = userEvent.setup();
    renderPlanner();

    await usuario.click(screen.getByRole('button', { name: /realizada: marcar entrevista de juan pérez/i }));
    expect(within(columna('Entrevista Realizada')).getByText('Juan Pérez')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: /devolver a la etapa anterior: juan pérez/i }));
    expect(within(columna('Entrevista Agendada')).getByText('Juan Pérez')).toBeInTheDocument();
  });

  it('lleva al detalle para registrar el informe', async () => {
    const usuario = userEvent.setup();
    renderPlanner();

    await usuario.click(screen.getByRole('button', { name: /realizada: marcar entrevista de juan pérez/i }));
    await usuario.click(screen.getByRole('button', { name: /registrar informe de juan pérez/i }));

    expect(screen.getByRole('heading', { name: 'Detalle de la solicitud' })).toBeInTheDocument();
  });

  it('filtra las tarjetas por texto y por reclutador/a', async () => {
    const usuario = userEvent.setup();
    renderPlanner();

    await usuario.type(screen.getByLabelText('Buscar'), 'analista de datos');
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.queryByText('María González')).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Limpiar' }));
    await usuario.selectOptions(screen.getByLabelText('Solicitado por'), 'Carolina Muñoz');
    expect(screen.queryByText('Juan Pérez')).not.toBeInTheDocument();
    expect(screen.getByText('María González')).toBeInTheDocument();
  });

  it('muestra el Planner en solo lectura para el perfil analista', () => {
    renderPlanner(ANALISTA);

    expect(screen.getByText('Vista de solo lectura')).toBeInTheDocument();
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /agendar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /realizada/i })).not.toBeInTheDocument();
  });

  it('colapsa las tareas completadas', async () => {
    const usuario = userEvent.setup();
    renderPlanner();

    const boton = screen.getByRole('button', { name: /tareas completadas/i });
    expect(boton).toHaveAttribute('aria-expanded', 'true');
    await usuario.click(boton);

    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/informe enviado el/i)).not.toBeInTheDocument();
  });

  it('enlaza a la pantalla con todos los informes enviados', async () => {
    const usuario = userEvent.setup();
    renderPlanner();

    await usuario.click(screen.getByRole('link', { name: /ver todos los informes/i }));
    expect(screen.getByRole('heading', { name: 'Pantalla de informes' })).toBeInTheDocument();
  });
});
