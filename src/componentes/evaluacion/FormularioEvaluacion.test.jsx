import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import FormularioEvaluacion from './FormularioEvaluacion';

const evaluacionExistente = {
  id: 1,
  solicitudId: 1,
  fechaEvaluacion: '2026-08-10',
  resultado: 'Aprobado',
  observaciones: 'Perfil estable para el cargo evaluado.',
  estado: 'Realizada',
};

const renderFormulario = (props = {}) => render(<FormularioEvaluacion alGuardar={vi.fn()} {...props} />);

describe('FormularioEvaluacion', () => {
  it('exige fecha, resultado y observaciones', async () => {
    const usuario = userEvent.setup();
    const alGuardar = vi.fn();
    renderFormulario({ alGuardar });

    await usuario.click(screen.getByRole('button', { name: /registrar evaluación/i }));

    expect(screen.getByText('Debe indicar el resultado de la evaluación.')).toBeInTheDocument();
    expect(screen.getByText('Las observaciones son obligatorias.')).toBeInTheDocument();
    expect(alGuardar).not.toHaveBeenCalled();
  });

  it('rechaza observaciones demasiado cortas', async () => {
    const usuario = userEvent.setup();
    const alGuardar = vi.fn();
    renderFormulario({ alGuardar });

    await usuario.click(screen.getByRole('radio', { name: 'Aprobado' }));
    await usuario.type(screen.getByLabelText(/observaciones/i), 'ok');
    await usuario.click(screen.getByRole('button', { name: /registrar evaluación/i }));

    expect(screen.getByText(/al menos 10 caracteres/i)).toBeInTheDocument();
    expect(alGuardar).not.toHaveBeenCalled();
  });

  it('entrega la evaluación cuando los datos son válidos', async () => {
    const usuario = userEvent.setup();
    const alGuardar = vi.fn();
    renderFormulario({ alGuardar });

    await usuario.clear(screen.getByLabelText(/fecha de evaluación/i));
    await usuario.type(screen.getByLabelText(/fecha de evaluación/i), '2026-03-05');
    await usuario.click(screen.getByRole('radio', { name: 'Reprobado' }));
    await usuario.type(
      screen.getByLabelText(/observaciones/i),
      'No cumple con los requisitos del cargo.',
    );
    await usuario.click(screen.getByRole('button', { name: /registrar evaluación/i }));

    expect(alGuardar).toHaveBeenCalledWith({
      fechaEvaluacion: '2026-03-05',
      resultado: 'Reprobado',
      observaciones: 'No cumple con los requisitos del cargo.',
      estado: 'Realizada',
    });
  });

  it('precarga los datos si la evaluación ya existe', () => {
    renderFormulario({ evaluacion: evaluacionExistente });

    expect(screen.getByLabelText(/fecha de evaluación/i)).toHaveValue('2026-08-10');
    expect(screen.getByRole('radio', { name: 'Aprobado' })).toBeChecked();
    expect(screen.getByRole('button', { name: /actualizar evaluación/i })).toBeInTheDocument();
  });

  it('exige los tres resultados disponibles', () => {
    renderFormulario();
    ['Aprobado', 'Reprobado', 'No concluyente'].forEach((resultado) => {
      expect(screen.getByRole('radio', { name: resultado })).toBeInTheDocument();
    });
  });
});
