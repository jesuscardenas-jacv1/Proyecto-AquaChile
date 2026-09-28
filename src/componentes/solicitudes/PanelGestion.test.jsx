import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderConContexto, datosVacios, datosDePrueba } from '../../pruebas/utilidades';
import PanelGestion from './PanelGestion';

const solicitud = {
  id: 3,
  candidatoId: 1,
  cargo: 'Técnico de Planta',
  familiaCargo: 'Operaciones',
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
        alGuardar={vi.fn()}
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
        alGuardar={vi.fn()}
        alAsignarProfesional={alAsignarProfesional}
        alCambiarEstado={alCambiarEstado}
      />,
      { datosIniciales: datosVacios },
    );

    await usuario.selectOptions(screen.getByLabelText(/^estado$/i), 'En proceso');
    expect(alCambiarEstado).toHaveBeenCalledWith('En proceso');

    await usuario.selectOptions(screen.getByLabelText(/profesional responsable/i), 'Camila Rojas');
    expect(alAsignarProfesional).toHaveBeenCalledWith('Camila Rojas');
  });

  it('entrega los cambios al guardar', async () => {
    const usuario = userEvent.setup();
    const alGuardar = vi.fn();

    renderConContexto(
      <PanelGestion
        solicitud={solicitud}
        alGuardar={alGuardar}
        alAsignarProfesional={vi.fn()}
        alCambiarEstado={vi.fn()}
      />,
      { datosIniciales: datosDePrueba },
    );

    await usuario.selectOptions(screen.getByLabelText(/^estado$/i), 'Finalizada');
    await usuario.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(alGuardar).toHaveBeenCalledWith({
      estado: 'Finalizada',
      profesionalResponsable: '',
      observaciones: '',
    });
  });

  it('ofrece los tres estados del flujo de trabajo', () => {
    renderConContexto(
      <PanelGestion
        solicitud={solicitud}
        alGuardar={vi.fn()}
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
