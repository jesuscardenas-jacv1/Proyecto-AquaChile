import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderConContexto, datosVacios } from '../../pruebas/utilidades';
import PanelGestion from './PanelGestion';

const solicitud = {
  id: 3,
  candidatoId: 1,
  cargo: 'Técnico de Planta',
  familiaCargo: 'Técnico B C',
  fechaSolicitud: '2026-09-01',
  estado: 'Pendiente',
  etapa: 'recibida',
  reclutador: 'Carolina Muñoz',
  profesionalResponsable: '',
  observaciones: '',
};

const renderPanel = (props = {}) =>
  renderConContexto(
    <PanelGestion solicitud={solicitud} alAsignarProfesional={vi.fn()} {...props} />,
    { datosIniciales: datosVacios },
  );

describe('PanelGestion', () => {
  it('muestra el estado y la etapa sin permitir cambiarlos', () => {
    renderPanel();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    expect(screen.getByText('Evaluación Recibida')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /estado/i })).toBeNull();
  });

  it('muestra la entrevista cuando la etapa es agendada', () => {
    renderPanel({
      solicitud: {
        ...solicitud,
        estado: 'En proceso',
        etapa: 'agendada',
        fechaEntrevista: '2026-09-09',
        horaEntrevista: '12:30',
      },
    });
    expect(screen.getByText(/entrevista agendada · entrevista coordinada para 9\/09 a las 12:30/i)).toBeInTheDocument();
  });

  it('indica cuando la solicitud se cerró sin informe', () => {
    renderPanel({ solicitud: { ...solicitud, estado: 'Finalizada', cierre: { motivo: 'Desistió del proceso' } } });
    expect(screen.getByText('Cerrada sin informe')).toBeInTheDocument();
  });

  it('notifica la asignación de la psicóloga responsable', async () => {
    const usuario = userEvent.setup();
    const alAsignarProfesional = vi.fn();
    renderPanel({ alAsignarProfesional });

    await usuario.selectOptions(screen.getByLabelText(/psicóloga responsable/i), 'Ignacia Valdés Ortiz');
    expect(alAsignarProfesional).toHaveBeenCalledWith('Ignacia Valdés Ortiz');
  });

  it('sin permiso para asignar muestra la psicóloga como texto', () => {
    renderPanel({
      solicitud: { ...solicitud, profesionalResponsable: 'Ignacia Valdés Ortiz' },
      puedeAsignar: false,
    });
    expect(screen.queryByRole('combobox', { name: /psicóloga responsable/i })).toBeNull();
    expect(screen.getByText('Ignacia Valdés Ortiz')).toBeInTheDocument();
  });

  it('lleva al Planner solo a quien gestiona la solicitud', () => {
    const { unmount } = renderPanel({ puedeGestionar: true });
    expect(screen.getByRole('link', { name: /gestionar en el planner/i })).toHaveAttribute('href', '/planner');
    unmount();

    renderPanel();
    expect(screen.queryByRole('link', { name: /gestionar en el planner/i })).toBeNull();
    expect(screen.getByText(/lo gestiona la psicóloga en su planner/i)).toBeInTheDocument();
  });
});
