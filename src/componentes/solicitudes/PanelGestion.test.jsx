import { render, screen } from '@testing-library/react';
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
  profesionalResponsable: '',
  observaciones: '',
};

describe('PanelGestion', () => {
  it('muestra el estado y el profesional de la solicitud', () => {
    renderConContexto(
      <PanelGestion
        solicitud={solicitud}
        alAsignarProfesional={vi.fn()}
        alCambiarEstado={vi.fn()}
      />,
      { datosIniciales: datosVacios },
    );

    expect(screen.getByLabelText(/^estado$/i)).toHaveValue('Pendiente');
    expect(screen.getByLabelText(/profesional responsable/i)).toHaveValue('');
  });

  it('notifica el cambio de estado y de profesional', async () => {
    const usuario = userEvent.setup();
    const alAsignarProfesional = vi.fn();
    const alCambiarEstado = vi.fn();

    renderConContexto(
      <PanelGestion
        solicitud={solicitud}
        alAsignarProfesional={alAsignarProfesional}
        alCambiarEstado={alCambiarEstado}
      />,
      { datosIniciales: datosVacios },
    );

    await usuario.selectOptions(screen.getByLabelText(/^estado$/i), 'En proceso');
    expect(alCambiarEstado).toHaveBeenCalledWith('En proceso');

    await usuario.selectOptions(screen.getByLabelText(/profesional responsable/i), 'Carolina Muñoz');
    expect(alAsignarProfesional).toHaveBeenCalledWith('Carolina Muñoz');
  });

  it('refleja el estado actual de la solicitud cuando cambia desde fuera', () => {
    const { rerender } = render(
      <PanelGestion
        solicitud={solicitud}
        alAsignarProfesional={vi.fn()}
        alCambiarEstado={vi.fn()}
      />,
    );

    rerender(
      <PanelGestion
        solicitud={{ ...solicitud, estado: 'Finalizada', profesionalResponsable: 'Javiera Soto' }}
        alAsignarProfesional={vi.fn()}
        alCambiarEstado={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^estado$/i)).toHaveValue('Finalizada');
    expect(screen.getByLabelText(/profesional responsable/i)).toHaveValue('Javiera Soto');
  });

  it('ofrece los tres estados del flujo de trabajo', () => {
    renderConContexto(
      <PanelGestion
        solicitud={solicitud}
        alAsignarProfesional={vi.fn()}
        alCambiarEstado={vi.fn()}
      />,
      { datosIniciales: datosVacios },
    );

    expect(screen.getByRole('option', { name: 'Pendiente' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'En proceso' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Finalizada' })).toBeInTheDocument();
  });
});
